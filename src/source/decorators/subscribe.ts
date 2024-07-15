/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClassProducer, IClassProducer, InferClassProducerState } from "../class-producer";

export const Subscribe = <T extends IClassProducer<InferClassProducerState<T>>, R>(
	selector: (state: InferClassProducerState<T>) => R,
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
			const typedClass = this as unknown as ClassProducer<any>;
			typedClass.__GetJanitor().Add(this.Subscribe(selector, (state, prev) => originalMethod(this, state, prev)));

			return result;
		};
	};
};
