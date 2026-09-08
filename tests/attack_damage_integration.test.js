const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = {};
vm.createContext(context);

vm.runInContext(fs.readFileSync("js/dice.js", "utf8"), context);
vm.runInContext(fs.readFileSync("js/damage.js", "utf8"), context);
vm.runInContext(fs.readFileSync("js/attack.js", "utf8"), context);

function makeState(){
    return {
        combatId:"combat-integration",
        active:true,
        phase:"turn",
        round:1,
        turnIndex:0,
        initiative:[{characterId:"kenji",total:15,order:0}],
        pendingRolls:[],
        eventSequence:0
    };
}

function makeCharacters(targetOverrides = {}){
    return [
        {
            id:"kenji",
            faction:"player",
            position:{x:2,y:2}
        },
        {
            id:"goblin",
            faction:"enemy",
            position:{x:3,y:2},
            ac:12,
            hp:10,
            max_hp:10,
            resistances:[],
            vulnerabilities:[],
            immunities:[],
            ...targetOverrides
        }
    ];
}

const map = {rules:{feetPerSquare:5}};
const intent = {
    intentId:"intent-1",
    actorId:"kenji",
    type:"action",
    status:"confirmed",
    payload:{
        attack:{
            targetId:"goblin",
            attackMode:"melee",
            reachFeet:5,
            attackBonus:5,
            rollMode:"normal"
        }
    }
};

{
    const state = makeState();
    const characters = makeCharacters();
    const attack = context.createAttackRollRequest(state,characters,map,intent);
    assert.strictEqual(attack.success,true);

    const attackSubmission = context.submitAttackRoll(
        state,
        attack.request,
        {rollId:attack.request.rollId,source:"player",results:[15]},
        attack.targetAC,
        attack.attackBonus
    );

    assert.strictEqual(attackSubmission.success,true);
    assert.strictEqual(attackSubmission.result.outcome,"hit");

    const damage = context.createDamageRollForAttack(
        state,
        attack.request,
        attackSubmission.result,
        {
            targetId:"goblin",
            actorId:"kenji",
            dice:{count:1,sides:8},
            damageBonus:3,
            damageType:"slashing"
        }
    );

    assert.strictEqual(damage.success,true);
    assert.strictEqual(damage.request.dice.count,1);
    assert.strictEqual(characters[1].hp,10);

    const damageSubmission = context.submitDamageRollForAttack(
        state,
        damage.request,
        {rollId:damage.request.rollId,source:"player",results:[6]},
        characters[1],
        damage.damageBonus,
        damage.damageType
    );

    assert.strictEqual(damageSubmission.success,true);
    assert.strictEqual(damageSubmission.damage.rawDamage,9);
    assert.strictEqual(characters[1].hp,1);
}

{
    const state = makeState();
    const characters = makeCharacters();
    const attack = context.createAttackRollRequest(state,characters,map,intent);
    const attackSubmission = context.submitAttackRoll(
        state,
        attack.request,
        {rollId:attack.request.rollId,source:"player",results:[5]},
        attack.targetAC,
        attack.attackBonus
    );

    assert.strictEqual(attackSubmission.result.outcome,"miss");

    const damage = context.createDamageRollForAttack(
        state,
        attack.request,
        attackSubmission.result,
        {
            targetId:"goblin",
            actorId:"kenji",
            dice:{count:1,sides:8},
            damageBonus:3,
            damageType:"slashing"
        }
    );

    assert.strictEqual(damage.success,false);
    assert.strictEqual(state.pendingRolls.length,1);
    assert.strictEqual(characters[1].hp,10);
}

{
    const state = makeState();
    const characters = makeCharacters({resistances:["slashing"]});
    const attack = context.createAttackRollRequest(state,characters,map,intent);
    const attackSubmission = context.submitAttackRoll(
        state,
        attack.request,
        {rollId:attack.request.rollId,source:"player",results:[20]},
        attack.targetAC,
        attack.attackBonus
    );

    assert.strictEqual(attackSubmission.result.outcome,"hit");
    assert.strictEqual(attackSubmission.result.critical,true);

    const damage = context.createDamageRollForAttack(
        state,
        attack.request,
        attackSubmission.result,
        {
            targetId:"goblin",
            actorId:"kenji",
            dice:{count:1,sides:8},
            damageBonus:3,
            damageType:"slashing"
        }
    );

    assert.strictEqual(damage.success,true);
    assert.strictEqual(damage.request.dice.count,2);

    const beforeHP = characters[1].hp;
    const damageSubmission = context.submitDamageRollForAttack(
        state,
        damage.request,
        {rollId:damage.request.rollId,source:"player",results:[8,6]},
        characters[1],
        damage.damageBonus,
        damage.damageType
    );

    assert.strictEqual(damageSubmission.success,true);
    assert.strictEqual(damageSubmission.damage.diceTotal,14);
    assert.strictEqual(damageSubmission.damage.rawDamage,17);
    assert.strictEqual(damageSubmission.damage.finalDamage,8);
    assert.strictEqual(characters[1].hp,beforeHP - 8);
}

{
    const state = makeState();
    const characters = makeCharacters();
    const attack = context.createAttackRollRequest(state,characters,map,intent);
    const attackSubmission = context.submitAttackRoll(
        state,
        attack.request,
        {rollId:attack.request.rollId,source:"player",results:[15]},
        attack.targetAC,
        attack.attackBonus
    );

    const damage = context.createDamageRollForAttack(
        state,
        attack.request,
        attackSubmission.result,
        {
            targetId:"goblin",
            actorId:"kenji",
            dice:{count:1,sides:8},
            damageBonus:3,
            damageType:"slashing"
        }
    );

    const invalid = context.submitDamageRollForAttack(
        state,
        damage.request,
        {rollId:damage.request.rollId,source:"python_rng",results:[6]},
        characters[1],
        damage.damageBonus,
        damage.damageType
    );

    assert.strictEqual(invalid.success,false);
    assert.strictEqual(characters[1].hp,10);
    assert.strictEqual(damage.request.status,"pending");
}

console.log("Attack damage integration tests passed");
