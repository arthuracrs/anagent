"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgent = getAgent;
exports.listAgents = listAgents;
const validator_js_1 = require("./validator.js");
const roles_js_1 = require("./roles.js");
const registry = new Map([
    ['validator', validator_js_1.validatorAgent],
    ['developer', roles_js_1.developerAgent],
    ['reviewer', roles_js_1.reviewerAgent],
]);
function getAgent(name) {
    return registry.get(name);
}
function listAgents() {
    return Array.from(registry.values());
}
