const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = {
    gameState: {
        turn: {
            active:true,
            phase:"turn",
            initiative:[
                {characterId:"kenji",total:15,order:0},
                {characterId:"mira",total:10,order:1}
            ],
            turnIndex:0,
            combatId:"ui-test"
        },
        party:[
            {
                id:"kenji",
                faction:"player",
                turnResources:{actionUsed:false},
                attacks:[{
                    name:"Longsword",
                    actionId:"attack-longsword",
                    attackMode:"melee",
                    reachFeet:5,
                    attackBonus:5,
                    damageDice:{count:1,sides:8},
                    damageBonus:3,
                    damageType:"slashing"
                }]
            },
            {
                id:"mira",
                faction:"player",
                turnResources:{actionUsed:false},
                attacks:[]
            }
        ]
    }
};

vm.createContext(context);
vm.runInContext(fs.readFileSync("js/combat_ui.js","utf8"),context);

const actor = context.getCurrentPlayerCharacter();
assert(actor,"Current player actor should be available");
assert.strictEqual(actor.id,"kenji","Current turn actor should be Kenji");
assert.strictEqual(context.getHostileTargets(actor).length,0,"Current fixture should have no hostile targets");

console.log("Combat UI tests: PASS");
