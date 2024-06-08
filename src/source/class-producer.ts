import { atom, Atom, subscribe } from "@rbxts/charm";
import { Janitor } from "@rbxts/janitor";

export type InferClassProducerState<T> = T extends IClassProducer<infer S> ? S : never;

export interface IClassProducer<S extends object = object> {
	GetState(): S;

	Subscribe(listener: (state: S, previousState: S) => void): () => void;
	Subscribe<T>(selector: (state: S) => T, listener: (state: T, previousState: T) => void): () => void;
	Subscribe(...args: unknown[]): () => void;

	Dispatch(newState: S): void;

	Destroy(): void;
}

export abstract class ClassProducer<S extends object = object> implements IClassProducer {
	protected abstract state: S;
	protected atom!: Atom<S>;
	private __janitor = new Janitor();

	constructor() {
		this.deferInitProducer();
	}

	public GetState() {
		return this.state;
	}

	public Subscribe(listener: (state: S, previousState: S) => void): () => void;
	public Subscribe<T>(selector: (state: S) => T, listener: (state: T, previousState: T) => void): () => void;
	public Subscribe(...args: unknown[]) {
		if (args.size() === 1) {
			const [listener] = args;
			return subscribe(this.atom, listener as never);
		}

		const [selector, listener] = args as [(state: S) => unknown, (state: unknown, previousState: unknown) => void];
		return subscribe(() => selector(this.atom()), listener as never);
	}

	public Dispatch(newState: S) {
		return this.atom(newState);
	}

	/** @internal @hidden */
	public __GetJanitor() {
		return this.__janitor;
	}

	public Destroy() {
		this.__janitor.Destroy();
	}

	/** @internal @hidden */
	private deferInitProducer() {
		this.subscribeToInitialState((state) => {
			this.state = undefined as never;
			this.atom = atom(state);
			this.initStateProperty();
		});
	}

	private initStateProperty() {
		const mt = (getmetatable(this) ?? {}) as LuaMetatable<ClassProducer>;
		const originalIndex = mt.__index as object;

		mt.__index = (t, index) => {
			if (index !== "state") return originalIndex[index as never];

			return this.atom();
		};
	}

	/** @internal @hidden */
	private subscribeToInitialState(subscriber: (state: S) => void) {
		const mt = (getmetatable(this) ?? {}) as LuaMetatable<ClassProducer>;
		const originalNewIndex = mt.__newindex;

		mt.__newindex = (t, index, value) => {
			originalNewIndex?.(t, index, value);
			rawset(t, index, value);
			if (index !== "state") return;
			mt.__newindex = originalNewIndex;
			subscriber(value as S);
		};
	}
}
