const fs = require("fs");
const vm = require("vm");

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/dice.js","utf8"),context);
vm.runInContext(fs.readFileSync("js/turn.js","utf8"),context);
vm.runInContext(fs.readFileSync("js/action.js","utf8"),context);
vm.runInContext(fs.readFileSync("js/attack.js","utf8"),context);

const {
    createCombatState,
    finalizeInitiative,
    validateActionIntent,
    createIntent,
    createActionResolutionPlan,
    commitActionResolution,
    createAttackRollRequest,
    submitAttackRoll
} = context;

function assert(condition,message){
    if(!condition) throw new Error(message);
}

function makeCharacter(id,faction,x,y,ac=13){
    return {
        id:id,
        name:id,
        faction:faction,
        ac:ac,
        abilities:{dex:10},
        movement:{remaining:30,spent:0,types:{walk:30}},
        conditions:[],
        position:{x:x,y:y}
    };
}

const kenji = makeCharacter("kenji","player",2,2,16);
const goblin = makeCharacter("goblin","enemy",3,2,13);
const farGoblin = makeCharacter("far_goblin","enemy",6,2,13);
const characters = [kenji,goblin,farGoblin];
const map = {width:10,height:10,rules:{feetPerSquare:5},tiles:[]};

const combat = createCombatState(characters,{combatId:"attack-test"});
assert(combat.success,"Combat state should initialize");
for(const request of combat.state.pendingRolls){
    const result = {
        rollId:request.rollId,
        source:request.source,
        results:[10]
    };
    const submitted = context.submitInitiativeRoll(
        combat.state,request.rollId,result,characters
    );
    assert(submitted.success,"Initiative result should resolve");
}

const initiative = finalizeInitiative(combat.state,characters);
assert(initiative.success,"Non-tied initiative should finalize");
assert(combat.state.initiative[0].characterId === "far_goblin" || combat.state.initiative.length === 3,"Combat should enter turn phase");

// Reorder test fixture so Kenji is the active actor.
combat.state.initiative = [
    {characterId:"kenji",initiativeRoll:10,total:10,order:0},
    {characterId:"goblin",initiativeRoll:9,total:9,order:1},
    {characterId:"far_goblin",initiativeRoll:8,total:8,order:2}
];
combat.state.turnIndex = 0;
context.resetTurnResources(kenji);

const intentResult = createIntent({
    intentId:"intent-attack-1",
    actorId:"kenji",
    type:"action",
    payload:{
        actionId:"attack"
    },
    source:"player"
});
const confirmedIntent = {...intentResult.intent,status:"confirmed"};

const actionValidation = validateActionIntent(combat.state,characters,confirmedIntent);
assert(actionValidation.valid,"Confirmed Action intent should be valid for current actor");

const planned = createActionResolutionPlan(combat.state,characters,confirmedIntent);
assert(planned.success,"Action should produce a resolution plan");
const committed = commitActionResolution(combat.state,characters,confirmedIntent,planned.plan);
assert(committed.success,"Action resource should be consumed before the attack proceeds");

// Use a separate turn state for attack request tests because the action resource
// above is now intentionally consumed.
const requestIntentResult = createIntent({
    intentId:"intent-attack-request",
    actorId:"kenji",
    type:"bonus_action",
    payload:{
        actionId:"special_attack",
        attack:{
            targetId:"goblin",
            attackMode:"melee",
            reachFeet:5,
            attackBonus:5,
            rollMode:"normal"
        }
    },
    source:"player"
});
const requestIntent = {...requestIntentResult.intent,status:"confirmed"};
const attackRequest = createAttackRollRequest(combat.state,characters,map,requestIntent);
assert(attackRequest.success,"A valid melee attack should create an Attack RollRequest");
assert(attackRequest.request.type === "attack","Attack request type should be attack");
assert(attackRequest.request.dice.count === 1 && attackRequest.request.dice.sides === 20,"Normal attack should request 1d20");
assert(attackRequest.request.source === "player","Player attack should use player roll source");
assert(attackRequest.targetId === "goblin","Attack request should bind target");
assert(attackRequest.targetAC === 13,"Attack request should snapshot target AC");

const beforeInitiative = JSON.stringify(combat.state.initiative);
const rollSubmission = submitAttackRoll(combat.state,attackRequest.request,{
    rollId:attackRequest.request.rollId,
    source:"player",
    results:[8]
},attackRequest.targetAC,attackRequest.attackBonus);
assert(rollSubmission.success,"Valid attack RollResult should resolve");
assert(rollSubmission.result.selected === 8,"Attack should use the submitted d20");
assert(rollSubmission.result.attackTotal === 13,"Attack total should include attack bonus");
assert(rollSubmission.result.outcome === "hit","Total equal to AC should hit");
assert(combat.state.hp === undefined,"Attack resolution should not invent top-level HP state");
assert(JSON.stringify(combat.state.initiative) === beforeInitiative,"Attack roll submission must not alter initiative state");

// Natural 20 is an automatic hit and critical.
const critIntent = createIntent({
    intentId:"intent-crit",
    actorId:"kenji",
    type:"reaction",
    payload:{
        actionId:"reaction_attack",
        attack:{targetId:"goblin",attackMode:"melee",reachFeet:5,attackBonus:0,rollMode:"normal"}
    },
    source:"player"
});
const critRequest = createAttackRollRequest(combat.state,characters,map,{...critIntent.intent,status:"confirmed"});
assert(critRequest.success,"Critical-hit fixture should create a request");
const crit = submitAttackRoll(combat.state,critRequest.request,{rollId:critRequest.request.rollId,source:"player",results:[20]},critRequest.targetAC,critRequest.attackBonus);
assert(crit.success && crit.result.outcome === "hit","Natural 20 must hit regardless of attack total");
assert(crit.result.critical === true,"Natural 20 must be marked critical");

// Natural 1 is an automatic miss regardless of attack bonus.
const nat1Intent = createIntent({
    intentId:"intent-nat1",
    actorId:"kenji",
    type:"reaction",
    payload:{
        actionId:"reaction_attack_2",
        attack:{targetId:"goblin",attackMode:"melee",reachFeet:5,attackBonus:20,rollMode:"normal"}
    },
    source:"player"
});
const nat1Request = createAttackRollRequest(combat.state,characters,map,{...nat1Intent.intent,status:"confirmed"});
assert(nat1Request.success,"Natural-1 fixture should create a request");
const nat1 = submitAttackRoll(combat.state,nat1Request.request,{rollId:nat1Request.request.rollId,source:"player",results:[1]},nat1Request.targetAC,nat1Request.attackBonus);
assert(nat1.success && nat1.result.outcome === "miss","Natural 1 must miss regardless of attack bonus");

// Invalid target, hostile target, and melee range are rejected before a roll request.
const ally = makeCharacter("ally","player",3,3,13);
const charactersWithAlly = [...characters,ally];
const badTargetIntent = createIntent({
    intentId:"intent-bad-target",
    actorId:"kenji",
    type:"action",
    payload:{actionId:"attack",attack:{targetId:"ally",attackMode:"melee",reachFeet:5,attackBonus:5}},
    source:"player"
});
const badTargetRequest = createAttackRollRequest(combat.state,charactersWithAlly,map,{...badTargetIntent.intent,status:"confirmed"});
assert(badTargetRequest.success === false,"Allied target must be rejected");

const outOfReachIntent = createIntent({
    intentId:"intent-out-of-reach",
    actorId:"kenji",
    type:"action",
    payload:{actionId:"attack_2",attack:{targetId:"far_goblin",attackMode:"melee",reachFeet:5,attackBonus:5}},
    source:"player"
});
const outOfReachRequest = createAttackRollRequest(combat.state,characters,map,{...outOfReachIntent.intent,status:"confirmed"});
assert(outOfReachRequest.success === false,"Target outside melee reach must be rejected");

// Ranged attacks beyond normal range are legal but require the attack to be made
// with disadvantage by the caller/next resolution layer.
const rangedIntent = createIntent({
    intentId:"intent-ranged",
    actorId:"kenji",
    type:"reaction",
    payload:{
        actionId:"ranged_attack",
        attack:{
            targetId:"far_goblin",
            attackMode:"ranged",
            normalRangeFeet:15,
            longRangeFeet:30,
            attackBonus:5,
            rollMode:"normal"
        }
    },
    source:"player"
});
const rangedRequest = createAttackRollRequest(combat.state,characters,map,{...rangedIntent.intent,status:"confirmed"});
assert(rangedRequest.success,"Target inside ranged long range should be legal");
assert(rangedRequest.distanceFeet === 20,"Attack distance should use grid distance in feet");

// Provenance must still be enforced by dice.js.
const invalidSource = submitAttackRoll(combat.state,rangedRequest.request,{rollId:rangedRequest.request.rollId,source:"python_rng",results:[10]},rangedRequest.targetAC,rangedRequest.attackBonus);
assert(invalidSource.success === false,"Mismatched RollResult source must be rejected");

console.log("Attack resolution tests: PASS");
