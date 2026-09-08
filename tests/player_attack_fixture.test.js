const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = {};
vm.createContext(context);

for(const path of [
    "js/dice.js",
    "js/intent.js",
    "js/turn.js",
    "js/action.js",
    "js/attack.js",
    "js/damage.js"
]){
    vm.runInContext(fs.readFileSync(path,"utf8"),context);
}

const party = JSON.parse(
    fs.readFileSync("data/characters.json","utf8")
);

const encounter = JSON.parse(
    fs.readFileSync("data/encounter.json","utf8")
);

const combatants = party.concat(encounter.enemies || []);
const map = JSON.parse(fs.readFileSync("data/map.json","utf8"));

const created = context.createCombatState(party,{combatId:"browser-attack-fixture"});
assert.strictEqual(created.success,true);
const state = created.state;

const kenjiRequest = state.pendingRolls.find(request => request.actorId === "kenji");
const miraRequest = state.pendingRolls.find(request => request.actorId === "mira");
assert(kenjiRequest && miraRequest);

assert.strictEqual(
    context.submitInitiativeRoll(
        state,
        kenjiRequest.rollId,
        {rollId:kenjiRequest.rollId,source:"player",results:[18]},
        party
    ).success,
    true
);

assert.strictEqual(
    context.submitInitiativeRoll(
        state,
        miraRequest.rollId,
        {rollId:miraRequest.rollId,source:"player",results:[10]},
        party
    ).success,
    true
);

const finalized = context.finalizeInitiative(state,party);
assert.strictEqual(finalized.success,true);
assert.strictEqual(finalized.character.id,"kenji");

const intentResult = context.createIntent({
    intentId:"browser-attack-intent",
    actorId:"kenji",
    type:"action",
    payload:{
        actionId:"kenji-longsword",
        attack:{
            targetId:"goblin_1",
            attackMode:"melee",
            reachFeet:5,
            attackBonus:5,
            rollMode:"normal"
        }
    },
    source:"player",
    rawText:"Attack Goblin 1"
});
assert.strictEqual(intentResult.success,true);
const intent = {...intentResult.intent,status:"confirmed"};

const actionPlan = context.createActionResolutionPlan(state,combatants,intent);
assert.strictEqual(actionPlan.success,true);

const attackRequest = context.createAttackRollRequest(
    state,
    combatants,
    map,
    intent
);
assert.strictEqual(attackRequest.success,true);
assert.strictEqual(attackRequest.targetId,"goblin_1");

const actionCommit = context.commitActionResolution(
    state,
    combatants,
    intent,
    actionPlan.plan
);
assert.strictEqual(actionCommit.success,true);
assert.strictEqual(party[0].turnResources.actionUsed,true);

const attackSubmitted = context.submitAttackRoll(
    state,
    attackRequest.request,
    {
        rollId:attackRequest.request.rollId,
        source:"player",
        results:[10]
    },
    attackRequest.targetAC,
    attackRequest.attackBonus
);
assert.strictEqual(attackSubmitted.success,true);
assert.strictEqual(attackSubmitted.result.outcome,"hit");
assert.strictEqual(attackSubmitted.result.attackTotal,15);

const goblin = combatants.find(character => character.id === "goblin_1");
const attack = party.find(character => character.id === "kenji").attacks[0];

const damageRequest = context.createDamageRollForAttack(
    state,
    attackRequest.request,
    attackSubmitted.result,
    {
        targetId:goblin.id,
        actorId:"kenji",
        dice:attack.damageDice,
        damageBonus:attack.damageBonus,
        damageType:attack.damageType
    }
);
assert.strictEqual(damageRequest.success,true);

const damageSubmitted = context.submitDamageRollForAttack(
    state,
    damageRequest.request,
    {
        rollId:damageRequest.request.rollId,
        source:"player",
        results:[4]
    },
    goblin,
    attack.damageBonus,
    attack.damageType
);
assert.strictEqual(damageSubmitted.success,true);
assert.strictEqual(damageSubmitted.damage.rawDamage,7);
assert.strictEqual(damageSubmitted.commit.previousHP,7);
assert.strictEqual(damageSubmitted.commit.currentHP,0);

console.log("Player attack fixture: PASS");
