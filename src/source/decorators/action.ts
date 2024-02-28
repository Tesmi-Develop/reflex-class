import { ClassProducer } from "../class-producer";

/**
 * Decorator for creating an Action inside a class producer.
 */
export const Action = () => {
	return <S extends object, T extends ClassProducer<S>>(
		target: T,
		propertyKey: string,
		descriptor: TypedPropertyDescriptor<(this: T, ...args: unknown[]) => S>,
	) => {
		const originalMethod = descriptor.value;

		descriptor.value = function (this: T, ...args: unknown[]) {
			const result = originalMethod(this, ...args);
			this.Dispatch(result);

			return result;
		};

		return descriptor;
	};
};
