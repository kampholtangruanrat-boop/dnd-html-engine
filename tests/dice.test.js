const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("js/dice.js","utf8");
const context = {};
vm.createContext(context);
vm.runInContext(source,context);

const {
    createRollRequest,
    validateRollRequest,
    validateRollResult,
    submitRollResult,
    getRollRequest
} = context;

function assert(condition,message){
    if(!condition){
        throw new Error(message);
    }
}

let created = createRollRequest({
    rollId:"r-player-001",
    actorId:"kenji",
    control:"player",
    type:"attack",
    dice:{count:1,sides:20},
    mode:"normal",
    source:"player"
});

assert(created.success,"Player RollRequest should be created");
assert(created.request.status === "pending","New RollRequest must start pending");

let state = {
    combatId:"test-combat",
    pendingRolls:[created.request],
    characters:{
        kenji:{hp:14}
    }
};

let result = submitRollResult(state,{
    rollId:"r-player-001",
    source:"player",
    results:[15]
});

assert(result.success,"Valid player RollResult should be accepted");
assert(result.rollRequest.status === "resolved","Accepted RollResult must resolve the request");
assert(state.characters.kenji.hp === 14,"Roll submission must not change character state");
assert(result.allRollsResolved === true,"All pending rolls should be resolved");

const resolvedAgain = submitRollResult(state,{
    rollId:"r-player-001",
    source:"player",
    results:[18]
});
assert(resolvedAgain.success === false,"A resolved RollRequest must not accept another result");

created = createRollRequest({
    rollId:"r-enemy-001",
    actorId:"goblin_01",
    control:"enemy",
    type:"attack",
    dice:{count:1,sides:20},
    mode:"normal",
    source:"python_rng"
});
assert(created.success,"Enemy RollRequest should use python_rng source");

let invalid = validateRollRequest({
    rollId:"bad-player-source",
    actorId:"kenji",
    control:"player",
    type:"attack",
    dice:{count:1,sides:20},
    mode:"normal",
    source:"python_rng",
    status:"pending"
});
assert(invalid.valid === false,"Player RollRequest must reject python_rng source");

invalid = validateRollResult(created.request,{
    rollId:"r-enemy-001",
    source:"player",
    results:[12]
});
assert(invalid.valid === false,"Enemy RollResult must reject player source");

invalid = validateRollResult(created.request,{
    rollId:"r-enemy-001",
    source:"python_rng",
    results:[0]
});
assert(invalid.valid === false,"Die result outside the die range must be rejected");

invalid = validateRollResult(created.request,{
    rollId:"wrong-roll-id",
    source:"python_rng",
    results:[12]
});
assert(invalid.valid === false,"Mismatched rollId must be rejected");

state.pendingRolls = [created.request];
result = submitRollResult(state,{
    rollId:"r-enemy-001",
    source:"python_rng",
    results:[12]
});
assert(result.success,"Valid enemy RollResult should be accepted");
assert(result.rollRequest.results[0] === 12,"Enemy roll result must be stored exactly");
assert(getRollRequest(state,"r-enemy-001") !== null,"Resolved RollRequest must remain addressable until cleared");

const cleared = context.clearResolvedRolls(state);
assert(cleared.success,"Resolved rolls should be clearable");
assert(state.pendingRolls.length === 0,"Clearing resolved rolls should remove them");

console.log("Dice protocol tests: PASS");
