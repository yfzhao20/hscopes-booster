"use strict";
const vscode = require('vscode')
const vsctm = require('vscode-textmate')
class DocumentController {
    /**
     * Constructor
     * @param {vscode.TextDocument} doc
     * @param {vsctm.IGrammar} textMateGrammar
     */
    constructor(doc, textMateGrammar) {
        /**
         * Store the Document.
         * @type {vscode.TextDocument}
         */
        this.document = doc;
        /**
         * Load the grammar analyzer.
         * @type {vsctm.IGrammar}
         */
        this.grammar = textMateGrammar;
        /**
         * Stores the state of each line 
         * @type {vsctm.ITokenizeLineResult[]} 
         */
        this.tokensArray = [];
        /**
         * Store document text of each line.
         * @type {string[]}
         */
        this.documentText = [];
        /**
         * Parse the whole document
         */     
        const docRange = new vscode.Range(0, 0, this.document.lineCount, 0)
        this.reparseRange(docRange);    // Parse whole document
        /** 
         * Store content changes. Will be clear when calling `getScopeAt()`.
         * @type {vscode.TextDocumentContentChangeEvent[]}
         */
        this.contentChangesArray = [];  // Stores text-change
        /**
         * Store the subscriptions
         */
        this.subscriptions = [];
        /**
         * onChangeDocument
         */
        this.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document == this.document && e.contentChanges.length){
                const changes = [...e.contentChanges].sort((change1, change2) => change1.range.start.isAfter(change2.range.start) ? 1 : -1);
                this.contentChangesArray = changes;
                this.applyChanges(changes)
            }
        }));
    }
    refresh(){
        this.tokensArray = [];
        const docRange = new vscode.Range(0, 0, this.document.lineCount, 0)
        this.reparseRange(docRange); 
        this.contentChangesArray = [];
    }
    dispose() {
        this.subscriptions.forEach((s) => s.dispose());
    }
    /** parser range */
    /**
     * @param {vscode.TextLine} line 
     */
    reparseLine(line){
        if(!this.grammar) 
            return;
        // Update text content
        this.documentText[line.lineNumber] = line.text
        // Don't tokenize line if too long
        if(line.text.length > 20000) {
            this.tokensArray[line.lineNumber] = undefined
            return
        }
        // Tokenize line
        const prevState = line.lineNumber ?  this.tokensArray[line.lineNumber - 1]?.ruleStack ?? null : null;
        const lineTokens = this.grammar.tokenizeLine(line.text, prevState);
        this.tokensArray[line.lineNumber] = lineTokens;
    }
    /**
     * @param {vscode.Range} range 
     */
    reparseRange(range){
        range = this.document.validateRange(range)
        for (let lineIndex = range.start.line; lineIndex <= range.end.line; lineIndex ++){
            const line = this.document.lineAt(lineIndex);
            this.reparseLine(line)
        }
    }
    /**
     * @param {vscode.TextDocumentContentChangeEvent[]} changes 
     */
    applyChanges(changes){
        for(let change of changes){
            // compare ruleStack
            const initState = this.tokensArray[change.range.end.line]?.ruleStack
            this.reparseRange(this.document.validateRange(change.range))
            const lastState = this.tokensArray[change.range.end.line]?.ruleStack

            // if (insert line count !== replaced content line count || ruleStack !== init ruleStack) 
            //  {parse the rest of document; return} 
            if( (change.range.end.line - change.range.start.line) !== (change.text.match(/\r\n|\n|\r/g)?.length ?? 0) || initState !== lastState  ){
                const moreRange = new vscode.Range(change.range.end.line+1, 0 , this.document.lineCount, 0)
                this.reparseRange(this.document.validateRange(moreRange))
                return;
            }
        }
    }
    /**
     * API: getScopeAt
     * @param {vscode.Position} position
     * @returns {TokensInfo}
     */
    getScopeAt(position){
        // let a = process.hrtime()[1]
        if (!this.grammar)
            return new TokensInfo(new vscode.Range(position,position),"",[]);
        position = this.document.validatePosition(position);

        // FIXME: if some other extensions call this API by changing text without triggering `onDidChangeTextDocument` event in this extension, it may cause error.
        if(!this.contentChangesArray.length && this.documentText[position.line] !== this.document.lineAt(position.line).text){
            this.reparseRange(new vscode.Range(position,position))
        }
        this.contentChangesArray.length = 0;

        const token = this.tokensArray[position.line]
        if (!token) 
            return new TokensInfo(new vscode.Range(position,position),"",[]);
        for (let index = token.tokens.length; index--;) {
            const thisToken = token.tokens[index]
            if (thisToken.startIndex <= position.character ){
                // console.log(process.hrtime()[1]-a); // TEST SPEED
                return new TokensInfo(
                    new vscode.Range(position.line, thisToken.startIndex, position.line, thisToken.endIndex),
                    this.document.lineAt(position.line).text.substring(thisToken.startIndex, thisToken.endIndex),
                    thisToken.scopes
                )
            }
        }

        // default
        return new TokensInfo(new vscode.Range(position,position),"",[]);
    }
}

/**
 * for getScopeAt
 */
class TokensInfo {
    /**
     * @param {vscode.Range} range 
     * @param {string} text 
     * @param {string[]} scopes 
     */
    constructor(range, text, scopes) {
        this.range = range;
        this.text = text;
        this.scopes = scopes;
    }
}

module.exports = {
    DocumentController
}