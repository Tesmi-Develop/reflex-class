import { Janitor } from "@rbxts/janitor";
import { Producer, ProducerImpl, ProducerMiddleware, createProducer } from "@rbxts/reflex";

export type InferClassProducerState<T> = T extends ClassProducer<infer S> ? S : never;

interface Actions {
	Dispatch: (state: unknown, newState: unknown) => unknown;
}

export abstract class ClassProducer<S extends object = object> {
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

	public Destroy() {
		this.__janitor.Destroy();
	}
}
