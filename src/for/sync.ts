import {Monad, MonadType} from "../monad/common";

type RegularFlatMap<MT extends MonadType, I, T> = (i: I) => Monad<MT, T>
type FlatMap<MT extends MonadType> = RegularFlatMap<MT, any, any>

type Step<MT extends MonadType> = {
    key: string,
    fun: FlatMap<MT>
}

type Program<MT extends MonadType, M extends Monad<MT, any>, I extends Record<string, any>> = {
    steps: Step<MT>[]
    _<OK extends string, OT>(
        outputKey: I extends { [_ in OK]: OT } ? never : OK,
        fun: RegularFlatMap<MT, I, OT>
    ): Program<MT, M, I & { [_ in OK]: OT }>,
    yield<YM extends Monad<MT, T>, T>(fun: (i: I) => T): Monad<MT, T> & YM
}

function program<MT extends MonadType, M extends Monad<MonadType, any>, I>(steps: Step<MT>[]): Program<MT, M, I> {
    return {
        steps: steps,
        _<OK extends string, OT>(
            outputKey: I extends { [_ in OK]: OT } ? never : OK,
            flatMapFunction: RegularFlatMap<MT, I, OT>
        ): Program<MT, M, I & { [_ in OK]: OT }> {
            return flatMap(this, outputKey, flatMapFunction);
        },
        yield<YM extends Monad<MT, T>, T>(fun: (i: I) => T): Monad<MT, T> & YM {
            return evaluate(this, fun);
        }
    }
}

function init<MT extends MonadType, M extends Monad<MT, T>, K extends string, T>(
    key: K,
    flatMapFunction: () => Monad<MT, T>
): Program<MT, M, { [_ in K]: T }> {
    return program([{key: key, fun: flatMapFunction}])
}

function flatMap<MT extends MonadType, M extends Monad<MT, OT>, I, K extends string, OT>(
    oldProgram: Program<MT, M, I>,
    outputKey: I extends { [_ in K]: OT } ? never : K,
    flatMapFunction: RegularFlatMap<MT, I, OT>
): Program<MT, M, I & { [_ in K]: OT }> {
    return program(oldProgram.steps.concat({key: outputKey, fun: flatMapFunction}))
}

function evaluate<MT extends MonadType, M extends Monad<MT, T>, I, T>(
    program: Program<MT, Monad<MT, any>, I>,
    mapFunction: (i: I) => T
): M {
    const head = program.steps[0]

    const headMonad = head.fun({})
    let input = headMonad.map((value) => ({[head.key]: value}))

    const tail = program.steps.slice(1)

    for (const step of tail) {
        const result = input.flatMap((i) => step.fun(i))
        input = input.flatMap((i) => result.map((v) => ({...i, ...{[step.key]: v}})))
    }

    // @ts-ignore
    return input.map(mapFunction);
}

export namespace For {
    export function _<MT extends MonadType, M extends Monad<MonadType, T>, K extends string, T>(
        key: K,
        flatMapFunction: () => Monad<MT, T>
    ): Program<MT, M, { [_ in K]: T }> {
        return init(key, flatMapFunction)
    }
}