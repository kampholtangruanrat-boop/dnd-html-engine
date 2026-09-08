const fs = require("fs");
const vm = require("vm");

const context = {};
vm.createContext(context);

for(const path of ["js/dice.js","js/turn.js","js/intent.js","js/action.js"]){
    vm.runInContext(fs.readFileSync(path,"utf8"),context);
}

const {
    createCombatState,
    submitInitiativeRoll,
    finalizeInitiative,
    getCurrentTurnCharacter
} = context;

const {
    createIntent,
    createConfirmationRequest,
    setPendingConfirmation,
    confirmPendingIntent
} = context;

const {
    validateActionIntent,
    createActionResolutionPlan,
    commitActionResolution,
    resolveActionIntent
} = context;

function assert(condition,message){
    if(!condition){
        throw new Error(message);
    }
}

function makeCharacter(id,dex){
    return {
        id:id,
        name:id,
        faction:"player",
        abilities:{dex:dex},
        movement:{
            remaining:30,
            spent:0,
            types:{walk:30}
        }
    };
}

const kenji = makeCharacter("kenji",16);
const mira = makeCharacter("mira",10);
const characters = [kenji,mira];

const created = createCombatState(characters,{combatId:"action-test"});
assert(created.success,"Combat state should initialize");

const state = created.state;
const kenjiRequest = state.pendingRolls.find(request => request.actorId === "kenji");
const miraRequest = state.pendingRolls.find(request => request.actorId === "mira");

let result = submitInitiativeRoll(state,kenjiRequest.rollId,{
    rollId:kenjiRequest.rollId,
    source:"player",
    results:[12]
});
assert(result.success,"Kenji initiative should resolve");

result = submitInitiativeRoll(state,miraRequest.rollId,{
    rollId:miraRequest.rollId,
    source:"player",
    results:[8]
});
assert(result.success,"Mira initiative should resolve");

result = finalizeInitiative(state,characters);
assert(result.success,"Initiative should finalize without a tie");
assert(state.phase === "turn","Combat should be in turn phase");
assert(getCurrentTurnCharacter(state,characters).id === "kenji","Highest initiative should be current actor");
assert(kenji.turnResources.actionUsed === false,"Current actor action should be ready");

let intentResult = createIntent({
    intentId:"intent-attack-1",
    actorId:"kenji",
    type:"action",
    payload:{actionId:"attack"},
    source:"player",
    rawText:"I attack the goblin."
});
assert(intentResult.success,"Action intent should be created");

let confirmationResult = createConfirmationRequest({
    confirmationId:"confirm-1",
    intent:intentResult.intent,
    question:"Confirm this attack action?"
});
assert(confirmationResult.success,"Confirmation request should be created");

setPendingConfirmation(state,confirmationResult.confirmation);
result = confirmPendingIntent(state,"confirm-1");
assert(result.success,"Action intent should be confirmable");
assert(result.intent.status === "confirmed","Confirmed intent must have confirmed status");

const beforeResolution = {
    actionUsed:kenji.turnResources.actionUsed,
    bonusActionUsed:kenji.turnResources.bonusActionUsed,
    reactionUsed:kenji.turnResources.reactionUsed,
    turnIndex:state.turnIndex,
    round:state.round
};

const planResult = createActionResolutionPlan(state,characters,result.intent);
assert(planResult.success,"Confirmed action should produce a resolution plan");
assert(planResult.plan.resource === "action","Action intent must resolve against action resource");
assert(planResult.plan.actionId === "attack","Resolution plan must preserve actionId");

assert(kenji.turnResources.actionUsed === beforeResolution.actionUsed,"Planning must not consume action resource");
assert(state.turnIndex === beforeResolution.turnIndex,"Planning must not advance turn");
assert(state.round === beforeResolution.round,"Planning must not change round");

result = commitActionResolution(state,characters,result.intent,planResult.plan);
assert(result.success,"Action resolution should commit");
assert(result.intent.status === "resolved","Committed action intent must become resolved");
assert(kenji.turnResources.actionUsed === true,"Committed action must consume Action");
assert(state.turnIndex === beforeResolution.turnIndex,"Resolving action must not advance turn automatically");
assert(state.round === beforeResolution.round,"Resolving action must not change round");

const duplicatePlan = createActionResolutionPlan(state,characters,result.intent);
assert(duplicatePlan.success === false,"Resolved intent must not be resolved a second time");

const bonusIntent = createIntent({
    intentId:"intent-bonus-1",
    actorId:"kenji",
    type:"bonus_action",
    payload:{actionId:"test_bonus"},
    source:"player"
});
assert(bonusIntent.success,"Bonus Action intent should be created");
bonusIntent.intent.status = "confirmed";

result = resolveActionIntent(state,characters,bonusIntent.intent);
assert(result.success,"Unused Bonus Action should resolve successfully");
assert(kenji.turnResources.bonusActionUsed === true,"Bonus Action should be consumed");

const secondAction = createIntent({
    intentId:"intent-attack-2",
    actorId:"kenji",
    type:"action",
    payload:{actionId:"attack_again"},
    source:"player"
});
assert(secondAction.success,"Second action intent should still be structurally valid");
secondAction.intent.status = "confirmed";

result = resolveActionIntent(state,characters,secondAction.intent);
assert(result.success === false,"A second Action must be rejected after the Action resource is used");
assert(kenji.turnResources.actionUsed === true,"Rejected second Action must not reset or refund the Action resource");

const wrongActor = createIntent({
    intentId:"intent-wrong-actor",
    actorId:"mira",
    type:"action",
    payload:{actionId:"attack"},
    source:"player"
});
assert(wrongActor.success,"Wrong-actor intent should be structurally valid");
wrongActor.intent.status = "confirmed";

const validation = validateActionIntent(state,characters,wrongActor.intent);
assert(validation.valid === false,"Non-current actor must not resolve an action");

const endTurnIntent = createIntent({
    intentId:"intent-end-turn",
    actorId:"kenji",
    type:"end_turn",
    payload:{},
    source:"player"
});
assert(endTurnIntent.success,"End-turn intent should be created");
endTurnIntent.intent.status = "confirmed";

const previousTurnIndex = state.turnIndex;
result = resolveActionIntent(state,characters,endTurnIntent.intent);
assert(result.success,"Confirmed end-turn intent should advance the turn");
assert(result.intent.status === "resolved","Resolved end-turn intent must become resolved");
assert(state.turnIndex === previousTurnIndex + 1,"End-turn should advance the initiative index");

console.log("Action resolution tests: PASS");
