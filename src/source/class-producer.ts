import { Janitor } from "@rbxts/janitor";
import { Producer, ProducerImpl, ProducerMiddleware, createProducer } from "@rbxts/reflex";

export type InferClassProducerState<T> = T extends IClassProducer<infer S> ? S : never;

interface Actions {
	Dispatch: (state: unknown, newState: unknown) => unknown;
}

export interface IClassProducer<S extends object = object> {
	GetState(): S;

	Subscribe(listener: (state: S, previousState: S) => void): () => void;
	Subscribe<T>(selector: (state: S) => T, listener: (state: T, previousState: T) => void): () => void;
	Subscribe<T>(
		selector: (state: S) => T,
		predicate: ((state: T, previousState: T) => boolean) | undefined,
		listener: (state: T, previousState: T) => void,
	): () => void;
	Subscribe<T>(...args: unknown[]): () => void;

	Dispatch(newState: S): void;

	Destroy(): void;
}

export abstract class ClassProducer<S extends object = object> implements IClassProducer {
	protected abstract state: S;
	protected producer!: Producer<S>;
	private __janitor = new Janitor();

	constructor() {
		this.deferInitProducer();
	}

	public GetState() {
		return this.state;
	}

	public Subscribe(listener: (state: S, previousState: S) => void): () => void;
	public Subscribe<T>(selector: (state: S) => T, listener: (state: T, previousState: T) => void): () => void;
	public Subscribe<T>(
		selector: (state: S) => T,
		predicate: ((state: T, previousState: T) => boolean) | undefined,
		listener: (state: T, previousState: T) => void,
	): () => void;
	public Subscribe<T>(...args: unknown[]) {
		const [listener, predicate, selector] = args;
		return this.producer.subscribe(listener as never, predicate as never, selector as never);
	}

	public Dispatch(newState: S) {
		return this.producer.Dispatch(newState);
	}

	/** @internal @hidden */
	public __GetJanitor() {
		return this.__janitor;
	}

	public Destroy() {
		this.__janitor.Destroy();
	}

	private initProducer(state: S) {
		const middlewareUpdateState: ProducerMiddleware = () => {
			return (nextAction, actionName) => {
				return (...args) => {
					const newState = nextAction(...args);
					this.state = newState as S;
					return newState;
				};
			};
		};

		const producer = createProducer(state, {
			Dispatch: (state: S, newState: S) => newState,
		}) as ProducerImpl<S, Actions>;
		producer.applyMiddleware(middlewareUpdateState);

		return producer;
	}

	/** @internal @hidden */
	private deferInitProducer() {
		this.subscribeToInitialState((state) => {
			this.producer = this.initProducer(this.state) as never;
		});
	}

	/** @internal @hidden */
	private subscribeToInitialState(subscriber: (state: S) => void) {
		const mt = (getmetatable(this) ?? {}) as LuaMetatable<ClassProducer>;

		mt.__newindex = (t, index, value) => {
			rawset(t, index, value);
			if (index !== "state") return;
			mt.__newindex = undefined;
			subscriber(value as S);
		};
	}
}
