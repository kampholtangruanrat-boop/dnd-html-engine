const fs = require("fs");
const vm = require("vm");

const source =
    fs.readFileSync("js/turn.js","utf8");

const context = {};
vm.createContext(context);
vm.runInContext(source,context);

const {
    createCombatState,
    getPendingRoll,
    submitInitiativeRoll,
    buildInitiativeOrder,
    beginTurn,
    advanceTurn,
    endCombat
} = context;

function assert(condition,message){
    if(!condition){
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

const kenji = makeCharacter("kenji","player",10);
const mira = makeCharacter("mira","player",16);
const goblin1 = makeCharacter("goblin_1","enemy",14,"goblins");
const goblin2 = makeCharacter("goblin_2","enemy",14,"goblins");

const characters = [kenji,mira,goblin1,goblin2];

const created = createCombatState(characters,{combatId:"test-combat"});

assert(created.success,"Combat state should initialize");

const state = created.state;

assert(state.active === true,"Combat should be active");
assert(state.phase === "initiative_pending","Combat must begin in initiative_pending phase");
assert(state.round === 0,"Round must remain 0 before initiative is finalized");
assert(state.turnIndex === -1,"Turn index must remain -1 before initiative is finalized");
assert(state.pendingRolls.length === 3,"Two players plus one identical-enemy group should create three RollRequests");

const kenjiRequest =
    state.pendingRolls.find(request => request.actorId === "kenji");
const miraRequest =
    state.pendingRolls.find(request => request.actorId === "mira");
const goblinRequest =
    state.pendingRolls.find(request => request.actorId === "goblins");

assert(kenjiRequest.source === "player","Player initiative must request a player-supplied roll");
assert(miraRequest.source === "player","Player initiative must request a player-supplied roll");
assert(goblinRequest.source === "python_rng","Enemy initiative must request Python RNG");
assert(goblinRequest.dice.count === 1 && goblinRequest.dice.sides === 20,"Initiative RollRequest must be 1d20");

let result = submitInitiativeRoll(state,kenjiRequest.rollId,[12],characters);
assert(result.success,"Kenji initiative result should be accepted");
assert(state.phase === "initiative_pending","State must not advance before all initiative results are resolved");

result = submitInitiativeRoll(state,miraRequest.rollId,[16],characters);
assert(result.success,"Mira initiative result should be accepted");

result = submitInitiativeRoll(state,goblinRequest.rollId,[10],characters);
assert(result.success,"Goblin initiative result should be accepted");
assert(result.allRollsResolved === true,"All initiative rolls should now be resolved");
assert(state.phase === "initiative_pending","Resolving rolls alone must not commit turn order");

result = buildInitiativeOrder(state);
assert(result.success,"Initiative should finalize when there are no ties");
assert(state.phase === "turn","Combat should enter turn phase after initiative is finalized");
assert(state.round === 1,"Combat should start at round 1");
assert(state.turnIndex === 0,"First turn index should be 0");
assert(state.initiative[0].characterId === "mira","Highest initiative should act first");

const current = beginTurn(state,characters);
assert(current.success && current.character.id === "mira","beginTurn should resolve the current combatant");
assert(mira.turnResources.actionUsed === false,"Action should reset at turn start");
assert(mira.turnResources.bonusActionUsed === false,"Bonus Action should reset at turn start");
assert(mira.turnResources.reactionUsed === false,"Reaction should reset at turn start");

mira.turnResources.actionUsed = true;
result = advanceTurn(state,characters);
assert(result.success,"Turn should advance");
assert(result.previousCharacterId === "mira","Advance should report the previous combatant");
assert(state.turnIndex === 1,"Turn index should advance");

result = advanceTurn(state,characters);
assert(result.success,"Turn should advance to the grouped enemy entries");
assert(state.turnIndex === 2,"Turn index should advance again");

result = advanceTurn(state,characters);
assert(result.success,"Turn should advance to the next round");
assert(state.turnIndex === 0,"Turn index should wrap to 0");
assert(state.round === 2,"Round should increment after the final initiative entry");

const ended = endCombat(state);
assert(ended.success,"Combat should end cleanly");
assert(state.active === false,"Ended combat must not remain active");
assert(state.phase === "ended","Ended combat must use ended phase");
assert(state.pendingRolls.length === 0,"Pending rolls must be cleared when combat ends");

const pendingAfterEnd = getPendingRoll(state,"does-not-exist");
assert(pendingAfterEnd === null,"Unknown roll IDs must return null");

console.log("Combat state tests: PASS");
