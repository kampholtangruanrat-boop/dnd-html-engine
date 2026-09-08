const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = {};
vm.createContext(context);

vm.runInContext(fs.readFileSync("js/dice.js", "utf8"), context);
vm.runInContext(fs.readFileSync("js/damage.js", "utf8"), context);

function makeRequest(overrides = {}){
    const result = context.createDamageRollRequest({
        rollId:overrides.rollId || "damage-1",
        actorId:overrides.actorId || "kenji",
        control:overrides.control || "player",
        dice:overrides.dice || {count:1,sides:8},
        source:overrides.source || "player",
        critical:Boolean(overrides.critical)
    });

    assert.strictEqual(result.success,true);
    return result.request;
}

{
    const request = makeRequest();
    const result = context.resolveDamageRoll(
        request,
        {rollId:request.rollId,source:"player",results:[5]},
        3,
        {resistances:[],vulnerabilities:[],immunities:[]},
        "slashing"
    );

    assert.strictEqual(result.success,true);
    assert.strictEqual(result.diceTotal,5);
    assert.strictEqual(result.rawDamage,8);
    assert.strictEqual(result.finalDamage,8);
}

{
    const request = makeRequest({critical:true});
    assert.strictEqual(request.dice.count,2);

    const result = context.resolveDamageRoll(
        request,
        {rollId:request.rollId,source:"player",results:[4,3]},
        2,
        {resistances:[],vulnerabilities:[],immunities:[]},
        "piercing"
    );

    assert.strictEqual(result.success,true);
    assert.strictEqual(result.rawDamage,9);
}

{
    const request = makeRequest();
    const target = {resistances:["fire"]};
    const result = context.resolveDamageRoll(
        request,
        {rollId:request.rollId,source:"player",results:[7]},
        2,
        target,
        "fire"
    );

    assert.strictEqual(result.finalDamage,4);
}

{
    const request = makeRequest();
    const target = {vulnerabilities:["cold"]};
    const result = context.resolveDamageRoll(
        request,
        {rollId:request.rollId,source:"player",results:[4]},
        1,
        target,
        "cold"
    );

    assert.strictEqual(result.finalDamage,10);
}

{
    const request = makeRequest();
    const target = {immunities:["poison"]};
    const result = context.resolveDamageRoll(
        request,
        {rollId:request.rollId,source:"player",results:[8]},
        4,
        target,
        "poison"
    );

    assert.strictEqual(result.finalDamage,0);
}

{
    const request = makeRequest();
    const target = {hp:12,max_hp:12,resistances:[]};
    const result = context.resolveDamageRoll(
        request,
        {rollId:request.rollId,source:"player",results:[6]},
        2,
        target,
        "slashing"
    );

    const committed = context.commitDamage(target,result);
    assert.strictEqual(committed.success,true);
    assert.strictEqual(target.hp,4);
    assert.strictEqual(committed.previousHP,12);
}

{
    const request = makeRequest();
    const invalid = context.resolveDamageRoll(
        request,
        {rollId:request.rollId,source:"python_rng",results:[6]},
        2,
        {resistances:[]},
        "slashing"
    );

    assert.strictEqual(invalid.success,false);
}

console.log("Damage resolution tests passed");
