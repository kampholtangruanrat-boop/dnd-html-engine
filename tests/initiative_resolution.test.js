const fs = require("fs");
const vm = require("vm");

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/dice.js","utf8"),context);
vm.runInContext(fs.readFileSync("js/turn.js","utf8"),context);

const {
    createCombatState,
    getPendingRoll,
    submitInitiativeRoll,
    finalizeInitiative
} = context;

function assert(condition,message){
    if(!condition){
        throw new Error(message);
    }
}

function expectFailure(fn,message){
    let threw = false;

    try{
        fn();
    }catch(error){
        threw = true;
    }

    if(!threw){
        throw new Error(message);
    }
}

function makeCharacter(id,faction,dex,initiativeGroupId = null){
    return {
        id:id,
        name:id,
        faction:faction,
        initiativeGroupId:initiativeGroupId,
        abilities:{dex:dex},
        movement:{
            remaining:30,
            spent:0,
            types:{walk:30}
        }
    };
}

const characters = [
    makeCharacter("kenji","player",10),
    makeCharacter("mira","player",16),
    makeCharacter("goblin_1","enemy",14,"goblins"),
    makeCharacter("goblin_2","enemy",14,"goblins")
];

const created = createCombatState(characters,{combatId:"initiative-integration"});
assert(created.success,"Combat state should initialize");
const state = created.state;

const kenjiRequest = getPendingRoll(state,"initiative-initiative-integration-1");
const miraRequest = getPendingRoll(state,"initiative-initiative-integration-2");
const goblinRequest = getPendingRoll(state,"initiative-initiative-integration-3");

assert(kenjiRequest && miraRequest && goblinRequest,"Expected three initiative RollRequests");
assert(kenjiRequest.source === "player","Player request must use player source");
assert(goblinRequest.source === "python_rng","Enemy request must use python_rng source");

const initialInitiative = JSON.stringify(state.initiative);
const initialRound = state.round;
const initialTurnIndex = state.turnIndex;

let result = submitInitiativeRoll(state,kenjiRequest.rollId,{
    rollId:kenjiRequest.rollId,
    source:"player",
    results:[12]
},characters);
assert(result.success,"Valid player RollResult should be accepted");
assert(state.initiative.length === 0,"Submitting a roll must not build initiative");
assert(JSON.stringify(state.initiative) === initialInitiative,"Initiative must not mutate on roll submission");
assert(state.round === initialRound && state.turnIndex === initialTurnIndex,"Turn state must not mutate on roll submission");
assert(kenjiRequest.status === "resolved","Resolved request should be marked resolved by dice protocol");

result = submitInitiativeRoll(state,miraRequest.rollId,{
    rollId:miraRequest.rollId,
    source:"player",
    results:[16]
},characters);
assert(result.success,"Second valid player RollResult should be accepted");

result = submitInitiativeRoll(state,goblinRequest.rollId,{
    rollId:goblinRequest.rollId,
    source:"python_rng",
    results:[10]
},characters);
assert(result.success,"Valid enemy RollResult should be accepted");
assert(result.allRollsResolved === true,"All initiative requests should be resolved");
assert(state.phase === "initiative_pending","Resolving all rolls must not finalize combat");

const resolvedGoblin = getPendingRoll(state,goblinRequest.rollId);
assert(resolvedGoblin.results[0] === 10,"Dice protocol must preserve the submitted die result");

const invalidSource = submitInitiativeRoll(state,"initiative-initiative-integration-1",{
    rollId:kenjiRequest.rollId,
    source:"python_rng",
    results:[18]
},characters);
assert(invalidSource.success === false,"Wrong roll source must be rejected");

const invalidRollId = submitInitiativeRoll(state,"initiative-does-not-exist",{
    rollId:"initiative-does-not-exist",
    source:"player",
    results:[18]
},characters);
assert(invalidRollId.success === false,"Unknown rollId must be rejected");

const invalidDie = createCombatState([makeCharacter("solo","player",10)],{combatId:"invalid-die"});
const invalidDieState = invalidDie.state;
const invalidDieRequest = invalidDieState.pendingRolls[0];
const invalidDieResult = submitInitiativeRoll(invalidDieState,invalidDieRequest.rollId,{
    rollId:invalidDieRequest.rollId,
    source:"player",
    results:[21]
},[invalidDieState]);
assert(invalidDieResult.success === false,"A d20 result above 20 must be rejected");

const duplicateResult = submitInitiativeRoll(state,kenjiRequest.rollId,{
    rollId:kenjiRequest.rollId,
    source:"player",
    results:[12]
},characters);
assert(duplicateResult.success === false,"A resolved RollRequest must reject duplicate submission");

const unresolved = createCombatState([
    makeCharacter("unresolved_a","player",10),
    makeCharacter("unresolved_b","player",10)
],{combatId:"unresolved"});
const unresolvedState = unresolved.state;
const unresolvedRequest = unresolvedState.pendingRolls[0];
submitInitiativeRoll(unresolvedState,unresolvedRequest.rollId,{
    rollId:unresolvedRequest.rollId,
    source:"player",
    results:[10]
},[
    makeCharacter("unresolved_a","player",10),
    makeCharacter("unresolved_b","player",10)
]);
const unresolvedFinal = finalizeInitiative(unresolvedState,[
    makeCharacter("unresolved_a","player",10),
    makeCharacter("unresolved_b","player",10)
]);
assert(unresolvedFinal.success === false,"Finalization must fail while any initiative request is unresolved");

const tieStateCreated = createCombatState(characters,{combatId:"tie"});
const tieState = tieStateCreated.state;
const tieRequests = tieState.pendingRolls;
for(const request of tieRequests){
    const results = request.control === "enemy" ? [10] : [12];
    const source = request.source;
    const response = submitInitiativeRoll(tieState,request.rollId,{
        rollId:request.rollId,
        source:source,
        results:results
    },characters);
    assert(response.success,"Tie setup roll should be accepted");
}

let tieFinal = finalizeInitiative(tieState);
assert(tieFinal.success === false,"Tie must block initiative finalization without explicit order");
assert(tieFinal.status === "needs_tiebreak","Tie must report needs_tiebreak");

const validTieOrder = {
    "12":["kenji","goblin_1","goblin_2"]
};

tieFinal = finalizeInitiative(tieState,characters,validTieOrder);
assert(tieFinal.success,"Valid explicit tie-break should finalize initiative");
assert(tieState.phase === "turn","Combat should enter turn phase after finalization");
assert(tieState.round === 1,"Round should begin at 1");
assert(tieState.turnIndex === 0,"Turn index should begin at 0");
assert(tieState.initiative.length === 4,"Grouped enemies must still have separate initiative entries");
assert(tieState.initiative[0].characterId === "kenji","Tie-break order should control the tied entries");
assert(tieFinal.character && tieFinal.character.id === "kenji","Finalization should begin the first turn");
assert(characters[0].turnResources.actionUsed === false,"First turn should reset Action");
assert(characters[0].turnResources.bonusActionUsed === false,"First turn should reset Bonus Action");
assert(characters[0].turnResources.reactionUsed === false,"First turn should reset Reaction");

const invalidTieOrder = {
    "12":["kenji","kenji","goblin_1"]
};
const anotherTie = createCombatState(characters,{combatId:"invalid-tie"});
for(const request of anotherTie.state.pendingRolls){
    const roll = request.control === "enemy" ? 10 : 12;
    submitInitiativeRoll(anotherTie.state,request.rollId,{
        rollId:request.rollId,
        source:request.source,
        results:[roll]
    },characters);
}
const invalidTieFinal = finalizeInitiative(anotherTie.state,characters,invalidTieOrder);
assert(invalidTieFinal.success === false,"Tie-break orders with duplicate or missing combatants must be rejected");

console.log("Initiative resolution tests: PASS");
