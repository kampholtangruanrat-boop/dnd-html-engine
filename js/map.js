const MAP_MODES = [
    "tactical",
    "world"
];


function isNonEmptyString(value){

    return typeof value === "string" && value.length > 0;
}


function isValidCoordinate(value){

    return Number.isInteger(value) && value >= 1;
}


function validateGrid(grid){

    if(!grid || typeof grid !== "object"){
        return {
            valid:false,
            reason:"Map grid is required"
        };
    }

    if(!Number.isInteger(grid.width) || grid.width <= 0){
        return {
            valid:false,
            reason:"Map grid width must be a positive integer"
        };
    }

    if(!Number.isInteger(grid.height) || grid.height <= 0){
        return {
            valid:false,
            reason:"Map grid height must be a positive integer"
        };
    }

    if(!Number.isInteger(grid.squareFeet) || grid.squareFeet <= 0){
        return {
            valid:false,
            reason:"Map grid squareFeet must be a positive integer"
        };
    }

    return {
        valid:true,
        reason:null
    };
}


function validateMapDefinition(map){

    if(!map || typeof map !== "object"){
        return {
            valid:false,
            reason:"Map definition must be an object"
        };
    }

    if(!isNonEmptyString(map.id)){
        return {
            valid:false,
            reason:"Map requires id"
        };
    }

    if(!MAP_MODES.includes(map.mode)){
        return {
            valid:false,
            reason:"Map mode must be tactical or world"
        };
    }

    if(!map.visual || typeof map.visual !== "object"){
        return {
            valid:false,
            reason:"Map visual definition is required"
        };
    }

    if(!isNonEmptyString(map.visual.image)){
        return {
            valid:false,
            reason:"Map visual image is required"
        };
    }

    const gridValidation = validateGrid(map.visual.grid);

    if(!gridValidation.valid){
        return gridValidation;
    }

    if(!map.logical || typeof map.logical !== "object"){
        return {
            valid:false,
            reason:"Map logical definition is required"
        };
    }

    return {
        valid:true,
        reason:null
    };
}


function createMapDefinition({
    id,
    mode = "tactical",
    image,
    width,
    height,
    squareFeet = 5,
    origin = {x:0,y:0},
    pixelSize = null,
    logical = {}
}){

    const map = {
        id:id,
        mode:mode,
        visual:{
            image:image,
            grid:{
                width:width,
                height:height,
                squareFeet:squareFeet,
                origin:{
                    x:origin.x,
                    y:origin.y
                },
                pixelSize:pixelSize
            }
        },
        logical:{
            terrain:logical.terrain || {},
            obstacles:logical.obstacles || {},
            cover:logical.cover || {},
            elevation:logical.elevation || {},
            regions:logical.regions || {}
        }
    };

    const validation = validateMapDefinition(map);

    if(!validation.valid){
        return {
            success:false,
            map:null,
            reason:validation.reason
        };
    }

    return {
        success:true,
        map:map
    };
}


function getMapCell(map,x,y){

    if(!map || !map.logical || !isValidCoordinate(x) || !isValidCoordinate(y)){
        return null;
    }

    const grid = map.visual.grid;

    if(x > grid.width || y > grid.height){
        return null;
    }

    const key = `${x},${y}`;

    const terrain =
        map.logical.terrain[key] || null;

    const obstacle =
        map.logical.obstacles[key] || null;

    const cover =
        map.logical.cover[key] || null;

    const elevation =
        map.logical.elevation[key] ?? null;

    return {
        x:x,
        y:y,
        terrain:terrain,
        obstacle:obstacle,
        cover:cover,
        elevation:elevation
    };
}


function getMapObstacle(map,x,y){

    const cell = getMapCell(map,x,y);

    return cell ? cell.obstacle : null;
}


function getMapTerrain(map,x,y){

    const cell = getMapCell(map,x,y);

    return cell ? cell.terrain : null;
}


function getMapCover(map,x,y){

    const cell = getMapCell(map,x,y);

    return cell ? cell.cover : null;
}


function createCampaignPluginContract({
    id,
    name,
    version,
    maps = {},
    encounters = {},
    metadata = {}
}){

    const plugin = {
        apiVersion:"1",
        id:id,
        name:name,
        version:version,
        metadata:metadata,
        maps:maps,
        encounters:encounters
    };

    const validation = validateCampaignPlugin(plugin);

    if(!validation.valid){
        return {
            success:false,
            plugin:null,
            reason:validation.reason
        };
    }

    return {
        success:true,
        plugin:plugin
    };
}


function validateCampaignPlugin(plugin){

    if(!plugin || typeof plugin !== "object"){
        return {
            valid:false,
            reason:"Campaign plugin must be an object"
        };
    }

    if(plugin.apiVersion !== "1"){
        return {
            valid:false,
            reason:"Unsupported campaign plugin API version"
        };
    }

    if(!isNonEmptyString(plugin.id)){
        return {
            valid:false,
            reason:"Campaign plugin requires id"
        };
    }

    if(!isNonEmptyString(plugin.name)){
        return {
            valid:false,
            reason:"Campaign plugin requires name"
        };
    }

    if(!isNonEmptyString(plugin.version)){
        return {
            valid:false,
            reason:"Campaign plugin requires version"
        };
    }

    if(!plugin.maps || typeof plugin.maps !== "object"){
        return {
            valid:false,
            reason:"Campaign plugin maps must be an object"
        };
    }

    for(const [mapId,map] of Object.entries(plugin.maps)){

        if(map.id !== mapId){
            return {
                valid:false,
                reason:`Campaign map key must match map.id: ${mapId}`
            };
        }

        const mapValidation = validateMapDefinition(map);

        if(!mapValidation.valid){
            return {
                valid:false,
                reason:`Invalid map ${mapId}: ${mapValidation.reason}`
            };
        }
    }

    return {
        valid:true,
        reason:null
    };
}


function getCampaignMap(plugin,mapId){

    if(!plugin || !plugin.maps || !isNonEmptyString(mapId)){
        return null;
    }

    return plugin.maps[mapId] || null;
}


function campaignGetMapCell(plugin,mapId,x,y){

    const map = getCampaignMap(plugin,mapId);

    return map ? getMapCell(map,x,y) : null;
}


function campaignGetMapObstacle(plugin,mapId,x,y){

    const map = getCampaignMap(plugin,mapId);

    return map ? getMapObstacle(map,x,y) : null;
}


function campaignGetMapTerrain(plugin,mapId,x,y){

    const map = getCampaignMap(plugin,mapId);

    return map ? getMapTerrain(map,x,y) : null;
}


function campaignGetMapCover(plugin,mapId,x,y){

    const map = getCampaignMap(plugin,mapId);

    return map ? getMapCover(map,x,y) : null;
}
