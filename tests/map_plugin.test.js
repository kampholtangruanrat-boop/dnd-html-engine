const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("js/map.js","utf8");
const context = {};
vm.createContext(context);
vm.runInContext(source,context);

const {
    validateMapDefinition,
    getMapCell,
    createCampaignPluginContract,
    validateCampaignPlugin,
    getCampaignMap,
    campaignGetMapCell,
    campaignGetMapObstacle,
    campaignGetMapTerrain,
    campaignGetMapCover
} = context;

function assert(condition,message){
    if(!condition){
        throw new Error(message);
    }
}

const map = {
    id:"test_map",
    mode:"tactical",
    visual:{
        image:"maps/test.webp",
        grid:{
            width:10,
            height:8,
            squareFeet:5,
            origin:{x:0,y:0},
            pixelSize:64
        }
    },
    logical:{
        terrain:{
            "2,3":{type:"mud",difficult:true}
        },
        obstacles:{
            "5,4":{
                id:"wall_01",
                type:"stone_wall",
                blocksMovement:true,
                blocksLineOfSight:true
            }
        },
        cover:{
            "4,4":{type:"half"}
        },
        elevation:{
            "7,7":5
        },
        regions:{
            "8,8":"forest"
        }
    }
};

let validation = validateMapDefinition(map);
assert(validation.valid,"Valid tactical map should pass validation");

let cell = getMapCell(map,5,4);
assert(cell && cell.obstacle.blocksMovement === true,"Map cell should expose logical obstacle data");
assert(cell.obstacle.blocksLineOfSight === true,"Map cell should expose line-of-sight blocking data");

cell = getMapCell(map,2,3);
assert(cell && cell.terrain.difficult === true,"Map cell should expose terrain data");

cell = getMapCell(map,4,4);
assert(cell && cell.cover.type === "half","Map cell should expose cover data");

assert(getMapCell(map,0,1) === null,"Coordinates below 1 should be invalid");
assert(getMapCell(map,11,1) === null,"Coordinates outside map width should be invalid");

let invalidMap = {
    ...map,
    mode:"invalid"
};
validation = validateMapDefinition(invalidMap);
assert(validation.valid === false,"Invalid map mode must be rejected");

const pluginResult = createCampaignPluginContract({
    id:"test_campaign",
    name:"Test Campaign",
    version:"1.0.0",
    maps:{
        test_map:map
    }
});

assert(pluginResult.success,"Valid campaign plugin should be created");
assert(pluginResult.plugin.apiVersion === "1","Campaign plugin API version should be explicit");

const plugin = pluginResult.plugin;
assert(validateCampaignPlugin(plugin).valid,"Created campaign plugin should validate");
assert(getCampaignMap(plugin,"test_map") === map,"Campaign should return its registered map");
assert(campaignGetMapCell(plugin,"test_map",5,4).obstacle.blocksMovement === true,"Campaign adapter should expose obstacle data");
assert(campaignGetMapObstacle(plugin,"test_map",5,4).id === "wall_01","Campaign adapter should expose obstacle lookup");
assert(campaignGetMapTerrain(plugin,"test_map",2,3).difficult === true,"Campaign adapter should expose terrain lookup");
assert(campaignGetMapCover(plugin,"test_map",4,4).type === "half","Campaign adapter should expose cover lookup");

invalidMap = {
    ...map,
    id:"other_id"
};

const invalidPlugin = validateCampaignPlugin({
    apiVersion:"1",
    id:"test_campaign",
    name:"Test Campaign",
    version:"1.0.0",
    maps:{
        test_map:invalidMap
    },
    encounters:{}
});
assert(invalidPlugin.valid === false,"Campaign map key/id mismatch must be rejected");

console.log("Map schema and campaign plugin tests: PASS");
