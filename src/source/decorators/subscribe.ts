import { ClassProducer, InferClassProducerState } from "../class-producer";

export const Subscribe = <T extends ClassProducer<InferClassProducerState<T>>, R>(
	selector: (state: InferClassProducerState<T>) => R,
	predicate?: (state: R, previousState: R) => boolean,
) => {
	return (
		target: T,
		propertyKey: string,
		descriptor: TypedPropertyDescriptor<(this: T, state?: R, previousState?: R) => void>,
	) => {
		const originalMethod = descriptor.value;
		const Ttarget = target as unknown as { constructor: (self: T, ...args: unknown[]) => void } & T;
		const originalConstructor = Ttarget.constructor;

		Ttarget.constructor = function (this, ...args: unknown[]) {
			const result = originalConstructor(this as never, ...args);
			this.__GetJanitor().Add(
				this.Subscribe(selector, predicate, (state, prev) => originalMethod(this, state, prev)),
			);

			return result;
		};
	};
};
