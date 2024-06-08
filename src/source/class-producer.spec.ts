/// <reference types="@rbxts/testez/globals" />

import { ClassProducer } from "./class-producer";
import { Action } from "./decorators/action";
import { Subscribe } from "./decorators/subscribe";

export = () => {
	it("Should create instance of class-producer", () => {
		const initState = {
			a: 1,
			b: 2,
		};

		class TestClass1 extends ClassProducer {
			state = initState;

			public GetProducer() {
				return this.atom;
			}
		}

		const inst = new TestClass1();
		expect(inst.GetState()).to.equal(initState);
		expect(initState).to.equal(inst.GetProducer()());
	});

	it("Should invoke action", () => {
		const initState = {
			a: 1,
			b: 2,
		};

		const nextState = {
			a: 2,
			b: 1,
		};

		class TestClass2 extends ClassProducer<typeof initState> {
			state = initState;

			@Action()
			public Patch() {
				return nextState;
			}
		}

		const inst = new TestClass2();
		inst.Patch();
		expect(inst.GetState()).to.equal(nextState);
	});

	it("Should invoke subscribe", () => {
		interface ITestState {
			a: number;
			b: number;
		}

		const initState: ITestState = {
			a: 1,
			b: 2,
		};

		const nextState: ITestState = {
			a: 2,
			b: 1,
		};

		let isInvoked = false;

		class TestClass extends ClassProducer<ITestState> {
			protected state = initState;

			@Action()
			public Patch() {
				return nextState;
			}

			@Subscribe((state) => state.a)
			private sub(newValue: number) {
				isInvoked = true;
			}
		}

		const inst = new TestClass();
		inst.Patch();
		task.wait(0.05);

		expect(isInvoked).to.equal(true);
	});

	it("Should correct work state property", () => {
		interface ITestState {
			a: number;
			b: number;
		}

		const initState: ITestState = {
			a: 1,
			b: 1,
		};

		class TestClass extends ClassProducer<ITestState> {
			protected state = initState;

			@Action()
			public Patch() {
				return {
					...this.state,
					a: this.state.a + 1,
				};
			}
		}

		const inst = new TestClass();
		inst.Patch();
		inst.Patch();
		inst.Patch();
		expect(inst.GetState().a).to.equal(4);
	});
};
