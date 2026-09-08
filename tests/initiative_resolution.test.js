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
assert(JSON.stringify(state.initiative) === initialInitiative,"Submitting a roll must not mutate initiative order");
assert(state.round === initialRound,"Submitting a roll must not mutate round");
assert(state.turnIndex === initialTurnIndex,"Submitting a roll must not mutate turn index");

const invalidSource = submitInitiativeRoll(state,miraRequest.rollId,{
    rollId:miraRequest.rollId,
    source:"python_rng",
    results:[12]
},characters);
assert(invalidSource.success === false,"Player initiative must reject python_rng results");

const invalidRollId = submitInitiativeRoll(state,miraRequest.rollId,{
    rollId:"wrong-roll-id",
    source:"player",
    results:[12]
},characters);
assert(invalidRollId.success === false,"Mismatched initiative rollId must be rejected");

const invalidValue = submitInitiativeRoll(state,miraRequest.rollId,{
    rollId:miraRequest.rollId,
    source:"player",
    results:[21]
},characters);
assert(invalidValue.success === false,"Initiative must reject values outside d20 range");

const unresolvedCreated = createCombatState([
    makeCharacter("unresolved_a","player",10),
    makeCharacter("unresolved_b","player",10)
]);
const unresolvedFinal = finalizeInitiative(unresolvedCreated.state);
assert(unresolvedFinal.success === false,"Finalization must fail while any initiative request is unresolved");

result = submitInitiativeRoll(state,miraRequest.rollId,{
    rollId:miraRequest.rollId,
    source:"player",
    results:[12]
},characters);
assert(result.success,"Second player initiative result should be accepted");

result = submitInitiativeRoll(state,goblinRequest.rollId,{
    rollId:goblinRequest.rollId,
    source:"python_rng",
    results:[10]
},characters);
assert(result.success,"Grouped enemy initiative result should be accepted");
assert(result.allRollsResolved === true,"All initiative requests should now be resolved");
assert(state.initiative.length === 0,"Resolving rolls alone must not commit initiative order");

result = finalizeInitiative(state);
assert(result.success === false,"Initiative ties must block finalization without explicit order");
assert(result.status === "needs_tiebreak","Tie must report needs_tiebreak");

const validTieOrder = {
    "12":["kenji","goblin_1","goblin_2"]
};

const tieStateCreated = createCombatState(characters,{combatId:"tie"});
const tieState = tieStateCreated.state;
const tieRequests = tieState.pendingRolls;
for(const request of tieRequests){
    const roll = request.actorId === "kenji"
        ? 10
        : request.actorId === "mira"
            ? 12
            : 8;
    const response = submitInitiativeRoll(tieState,request.rollId,{
        rollId:request.rollId,
        source:request.source,
        results:[roll]
    },characters);
    assert(response.success,"Tie setup roll should be accepted");
}

tieStateCreated.state.pendingRolls.forEach(request => {
    assert(request.status === "resolved","All tie setup RollRequests should resolve");
});

tieStateCreated.state.initiative = [];
let tieFinal = finalizeInitiative(tieState);
assert(tieFinal.success === false,"Tie must block initiative finalization without explicit order");
assert(tieFinal.status === "needs_tiebreak","Tie must report needs_tiebreak");

tieFinal = finalizeInitiative(tieState,characters,{
    "10":["kenji","goblin_1","goblin_2"]
});
assert(tieFinal.success,"Valid explicit tie-break should finalize initiative");
assert(tieState.phase === "turn","Combat should enter turn phase after finalization");
assert(tieState.round === 1,"Round should begin at 1");
assert(tieState.turnIndex === 0,"Turn index should begin at 0");
assert(tieState.initiative.length === 4,"Grouped enemies must still have separate initiative entries");
assert(tieState.initiative[0].characterId === "mira","Highest initiative should act first");
assert(tieState.initiative[1].characterId === "kenji","Tie-break order should control the tied entries");
assert(tieFinal.character && tieFinal.character.id === "mira","Finalization should begin the first turn");
assert(characters[1].turnResources.actionUsed === false,"First turn should reset Action");
assert(characters[1].turnResources.bonusActionUsed === false,"First turn should reset Bonus Action");
assert(characters[1].turnResources.reactionUsed === false,"First turn should reset Reaction");

const invalidTieOrder = {
    "10":["kenji","kenji","goblin_1"]
};
const anotherTie = createCombatState(characters,{combatId:"invalid-tie"});
for(const request of anotherTie.state.pendingRolls){
    const roll = request.actorId === "kenji"
        ? 10
        : request.actorId === "mira"
            ? 12
            : 8;
    submitInitiativeRoll(anotherTie.state,request.rollId,{
        rollId:request.rollId,
        source:request.source,
        results:[roll]
    },characters);
}
const invalidTieFinal = finalizeInitiative(anotherTie.state,characters,invalidTieOrder);
assert(invalidTieFinal.success === false,"Tie-break orders with duplicate or missing combatants must be rejected");

console.log("Initiative resolution tests: PASS");
