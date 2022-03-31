/**
 * refer to `draivin.hscopes`
 * @license MIT
 */
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
//////////////////////////////////////////////////////
/**
 * IMPORT `TEXTMATE` PACKAGE AND INIT
 */
const vsctm = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');
const wasmBin = fs.readFileSync(path.join(__dirname, '../node_modules/vscode-oniguruma/release/onig.wasm')).buffer;
const vscodeOnigurumaLib = oniguruma.loadWASM(wasmBin).then(() => {
    return {
        createOnigScanner(patterns) { return new oniguruma.OnigScanner(patterns); },
        createOnigString(s) { return new oniguruma.OnigString(s); }
    };
});
let registry;
function reloadGrammar() {
    try {
        registry = new vsctm.Registry({
            onigLib: vscodeOnigurumaLib,
            getInjections: (scopeName) => {
                let extensions = vscode.extensions.all.filter((x) => x.packageJSON && x.packageJSON.contributes && x.packageJSON.contributes.grammars);
                let grammars = extensions.flatMap((e) => {
                    return e.packageJSON.contributes.grammars;
                });
                return grammars
                    .filter((g) => g.injectTo && g.injectTo.some((s) => s === scopeName))
                    .map((g) => g.scopeName);
            },
            loadGrammar: async (scopeName) => {
                try {
                    let extensions = vscode.extensions.all.filter((x) => x.packageJSON && x.packageJSON.contributes && x.packageJSON.contributes.grammars);
                    let grammars = extensions.flatMap((e) => {
                        return e.packageJSON.contributes.grammars.map((g) => {
                            return { extensionPath: e.extensionPath, ...g };
                        });
                    });
                    const matchingGrammars = grammars.filter((g) => g.scopeName === scopeName);
                    if (matchingGrammars.length > 0) {
                        const grammar = matchingGrammars[0];
                        const filePath = path.join(grammar.extensionPath, grammar.path);
                        let content = await fs.promises.readFile(filePath, 'utf-8');
                        return await vsctm.parseRawGrammar(content, filePath);
                    }
                }
                catch (err) {
                    console.error(`HyperScopes: Unable to load grammar for scope ${scopeName}.`, err);
                }
                return undefined;
            },
        });
    }
    catch (err) {
        registry = undefined;
        console.error(err);
    }
}
/**
 * @param {string} languageId 
 */
function getLanguageScopeName(languageId) {
    try {
        const languages = vscode.extensions.all
            .filter((x) => x.packageJSON && x.packageJSON.contributes && x.packageJSON.contributes.grammars)
            .reduce((a, b) => [
            ...a,
            ...b.packageJSON.contributes.grammars,
        ], []);
        const matchingLanguages = languages.filter((g) => g.language === languageId);
        if (matchingLanguages.length > 0) {
            // console.info(`Mapping language ${languageId} to initial scope ${matchingLanguages[0].scopeName}`);
            return matchingLanguages[0].scopeName;
        }
    }
    catch (err) {
        console.log("HyperScopes: Unable to get language scope name", err);
    }
    return undefined;
}

/////////////////////////////////////////////////////////
/**
 * DOCUMENT CONTROLLER IMPORT 
 */
const { DocumentController  } = require("./document-controller")
let documentsMap = new Map();
/**
 * @param {vscode.TextDocument} document 
 */
async function openDocument(document) {
    try {
        const thisDocController = documentsMap.get(document.uri);
        if (thisDocController) {
            thisDocController.refresh();
        }
        else if (registry) {
            const scopeName = getLanguageScopeName(document.languageId);
            if (scopeName) {
                const grammar = await registry.loadGrammar(scopeName);
                documentsMap.set(document.uri, new DocumentController(document, grammar));
            }
        }
    }
    catch (err) {
        console.log("HyperScopes: Unable to load document controller",err);
    }
}
function reloadDocuments(){
    unloadDocuments();
    for (const document of vscode.workspace.textDocuments)
        openDocument(document);
}
/**
 * @param {vscode.TextDocument} document 
 */
function closeDocument(document) {
    const thisDocController = documentsMap.get(document.uri);
    if (thisDocController) {
        thisDocController.dispose();
        documentsMap.delete(document.uri);
    }
}
function unloadDocuments() {
    for (const thisDocController of documentsMap.values()) {
        thisDocController.dispose();
    }
    documentsMap.clear();
}

//////////////////////////////////////////////////////////
/**
 * MAIN ACTIVATE FUNCTION
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(openDocument));
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(closeDocument));
	reloadGrammar();
    reloadDocuments();
    /** EXPORT API */
    const api = {
        /**
         * @param {vscode.TextDocument} document
         * @param {vscode.Position} position
         */
        getScopeAt(document, position) {
            try {
                const thisDocController = documentsMap.get(document.uri);
                if (thisDocController) {
                    return thisDocController.getScopeAt(position);
                }
            }
            catch (err) { console.error("HyperScopes: Unable to get Scope at position: ", position, "\n",err); }
            return null;
        },
    }
    return api;
}

function deactivate() {unloadDocuments()}

module.exports = {
	activate,
	deactivate
}
