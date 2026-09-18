const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/condition.js","utf8"),context);

{
    const goblin = {hp:0,max_hp:7,conditions:[]};
    const result = context.setDead(goblin);
    assert.strictEqual(result.success,true);
    assert.strictEqual(goblin.lifeState,"dead");
    assert.deepStrictEqual(goblin.conditions,[]);
}

{
    const fighter = {hp:0,max_hp:14,conditions:[]};
    const result = context.setUnconscious(fighter);
    assert.strictEqual(result.success,true);
    assert.strictEqual(fighter.lifeState,"unconscious");
    assert.strictEqual(fighter.stable,false);
    assert(fighter.conditions.includes("unconscious"));
    assert(fighter.conditions.includes("incapacitated"));
    assert(fighter.conditions.includes("prone"));
}

{
    const stable = {hp:0,max_hp:14,conditions:[]};
    const result = context.setStable(stable);
    assert.strictEqual(result.success,true);
    assert.strictEqual(stable.stable,true);
    assert(stable.conditions.includes("unconscious"));
}

{
    const creature = {hp:0,max_hp:14,conditions:[]};
    context.setUnconscious(creature);
    creature.hp = 5;
    const restored = context.restoreFromZeroHP(creature);
    assert.strictEqual(restored.success,true);
    assert.strictEqual(creature.lifeState,"alive");
    assert.strictEqual(creature.conditions.length,0);
    assert.strictEqual(creature.stable,false);
}

{
    const unconscious = {hp:1,max_hp:7,conditions:[]};
    context.setUnconscious(unconscious);
    assert.strictEqual(context.hasCondition(unconscious,"incapacitated"),true);
    assert.strictEqual(context.hasCondition(unconscious,"prone"),true);
}

console.log("Condition state tests: PASS");
