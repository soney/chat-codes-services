"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//<reference path="./typings/node/node.d.ts" />
const _ = require("underscore");
const FuzzySet = require("fuzzyset.js");
const events_1 = require("events");
const CodeMirror = require("codemirror");
const ShareDB = require("sharedb/lib/client");
const otText = require("ot-text");
ShareDB.types.map['json0'].registerSubtype(otText.type);
;
const CURRENT = -1;
/*
 * Tracks a set of remote cursors.
 */
class RemoteCursorMarker extends events_1.EventEmitter {
    constructor(editorState) {
        super();
        this.editorState = editorState;
        this.cursors = new Map();
    }
    updateCursor(id, user, pos) {
        if (!user.getIsMe()) {
            let cursor;
            if (this.cursors.has(id)) {
                cursor = this.cursors.get(id);
            }
            else {
                cursor = { id: id, user: user };
                this.cursors.set(id, cursor);
                this.editorState.getEditorWrapper().addRemoteCursor(cursor, this);
            }
            const oldPos = cursor.pos;
            cursor.pos = pos;
            if (oldPos) {
                this.editorState.getEditorWrapper().updateRemoteCursorPosition(cursor, this);
            }
            else {
                this.editorState.getEditorWrapper().addRemoteCursorPosition(cursor, this);
            }
        }
    }
    ;
    updateSelection(id, user, range) {
        if (!user.getIsMe()) {
            let cursor;
            if (this.cursors.has(id)) {
                cursor = this.cursors.get(id);
            }
            else {
                cursor = { id: id, user: user };
                this.cursors.set(id, { id: id, user: user });
                this.editorState.getEditorWrapper().addRemoteCursor(cursor, this);
            }
            const oldRange = cursor.range;
            cursor.range = range;
            if (oldRange) {
                this.editorState.getEditorWrapper().updateRemoteCursorSelection(cursor, this);
            }
            else {
                this.editorState.getEditorWrapper().addRemoteCursorSelection(cursor, this);
            }
        }
    }
    ;
    removeCursor(id, user) {
        if (this.cursors.has(id)) {
            this.editorState.getEditorWrapper().removeRemoteCursor(this.cursors.get(id), this);
            this.cursors.delete(id);
        }
    }
    getCursors() {
        return Array.from(this.cursors.values());
    }
    serialize() {
        return {
            cursors: this.cursors
        };
    }
    removeUserCursors(user) {
        this.cursors.forEach((cursor, id) => {
            if (cursor.user.id === user.id) {
                this.removeCursor(id, user);
            }
        });
    }
}
exports.RemoteCursorMarker = RemoteCursorMarker;
class TitleDelta {
    /**
     * Represents a change where the title of the editor window has changed
     */
    constructor(serializedState, author, editorState) {
        this.serializedState = serializedState;
        this.author = author;
        this.editorState = editorState;
        this.oldTitle = serializedState.oldTitle;
        this.newTitle = serializedState.newTitle;
        this.timestamp = serializedState.timestamp;
    }
    getTimestamp() { return this.timestamp; }
    ;
    doAction(editorWrapper) {
        this.editorState.setTitle(this.newTitle);
    }
    undoAction(editorWrapper) {
        this.editorState.setTitle(this.oldTitle);
    }
    serialize() {
        return this.serializedState;
    }
    getAuthor() { return this.author; }
    ;
    getEditorState() { return this.editorState; }
    ;
}
exports.TitleDelta = TitleDelta;
class GrammarDelta {
    /**
     * Represents a change where the grammar (think of syntax highlighting rules) has changed
     */
    constructor(serializedState, author, editorState) {
        this.serializedState = serializedState;
        this.author = author;
        this.editorState = editorState;
        this.oldGrammarName = serializedState.oldGrammarName;
        this.newGrammarName = serializedState.newGrammarName;
        this.timestamp = serializedState.timestamp;
    }
    getTimestamp() { return this.timestamp; }
    ;
    doAction(editorWrapper) {
        editorWrapper.setGrammar(this.newGrammarName);
    }
    undoAction(editorWrapper) {
        editorWrapper.setGrammar(this.oldGrammarName);
    }
    serialize() { return this.serializedState; }
    getAuthor() { return this.author; }
    ;
    getEditorState() { return this.editorState; }
    ;
}
exports.GrammarDelta = GrammarDelta;
class EditChange {
    /**
     * Represents a change where text has been edited
     */
    constructor(serializedState, author, editorState) {
        this.serializedState = serializedState;
        this.author = author;
        this.editorState = editorState;
        this.oldRange = serializedState.oldRange;
        this.newRange = serializedState.newRange;
        this.oldText = serializedState.oldText;
        this.newText = serializedState.newText;
    }
    getTimestamp() { return this.timestamp; }
    ;
    doAction(editorWrapper) {
        const { oldText, newRange } = editorWrapper.replaceText(this.oldRange, this.newText);
        this.newRange = newRange;
        this.oldText = oldText;
    }
    undoAction(editorWrapper) {
        const { oldText, newRange } = editorWrapper.replaceText(this.newRange, this.oldText);
        this.oldRange = newRange;
        this.newText = oldText;
    }
    serialize() { return this.serializedState; }
    getAuthor() { return this.author; }
    ;
    getEditorState() { return this.editorState; }
    ;
    getOldRange() { return this.oldRange; }
    getNewText() { return this.newText; }
}
exports.EditChange = EditChange;
class EditDelta {
    /**
     * Represents a change made to the text of a document. Contains a series of EditChange
     * objects representing the individual changes
     */
    constructor(serializedState, author, editorState) {
        this.serializedState = serializedState;
        this.author = author;
        this.editorState = editorState;
        this.timestamp = serializedState.timestamp;
        this.changes = serializedState.changes.map((ss) => {
            return new EditChange(ss, this.author, this.editorState);
        });
    }
    getTimestamp() { return this.timestamp; }
    ;
    doAction(editorWrapper) {
        this.changes.forEach((c) => {
            c.doAction(editorWrapper);
        });
    }
    undoAction(editorWrapper) {
        this.changes.forEach((c) => {
            c.undoAction(editorWrapper);
        });
    }
    serialize() { return this.serializedState; }
    getAuthor() { return this.author; }
    ;
    getEditorState() { return this.editorState; }
    ;
    getChanges() { return this.changes; }
    ;
}
exports.EditDelta = EditDelta;
class OpenDelta {
    /**
     * Represents a new text editor being opened
     */
    constructor(serializedState, author, editorState) {
        this.serializedState = serializedState;
        this.author = author;
        this.editorState = editorState;
        this.grammarName = serializedState.grammarName;
        this.title = serializedState.title;
        this.timestamp = serializedState.timestamp;
        this.contents = serializedState.contents;
    }
    getTimestamp() { return this.timestamp; }
    ;
    doAction(editorWrapper) {
        this.editorState.setTitle(this.title);
        this.editorState.setIsOpen(true);
        editorWrapper.setGrammar(this.grammarName);
        editorWrapper.setText(this.contents);
    }
    undoAction(editorWrapper) {
        this.editorState.setTitle('');
        this.editorState.setIsOpen(false);
        editorWrapper.setText('');
    }
    getContents() { return this.contents; }
    ;
    serialize() { return this.serializedState; }
    getAuthor() { return this.author; }
    ;
    getEditorState() { return this.editorState; }
    ;
}
exports.OpenDelta = OpenDelta;
class DestroyDelta {
    /**
     * Represents a text editor being closed.
     */
    constructor(serializedState, author, editorState) {
        this.serializedState = serializedState;
        this.author = author;
        this.editorState = editorState;
        this.timestamp = serializedState.timestamp;
    }
    getTimestamp() { return this.timestamp; }
    ;
    doAction(editorWrapper) {
        this.editorState.setIsOpen(false);
    }
    undoAction(editorWrapper) {
        this.editorState.setIsOpen(true);
    }
    serialize() { return this.serializedState; }
    getAuthor() { return this.author; }
    ;
    getEditorState() { return this.editorState; }
    ;
}
exports.DestroyDelta = DestroyDelta;
class ModifiedDelta {
    /**
     * Represents a change to the *modified* flag (which marks if a file has been changed
     * without having been saved)
     */
    constructor(serializedState, author, editorState) {
        this.serializedState = serializedState;
        this.author = author;
        this.editorState = editorState;
        this.timestamp = serializedState.timestamp;
        this.modified = serializedState.modified;
        this.oldModified = serializedState.oldModified;
    }
    getTimestamp() { return this.timestamp; }
    ;
    doAction(editorWrapper) {
        this.editorState.setIsModified(this.modified);
    }
    undoAction(editorWrapper) {
        this.editorState.setIsModified(this.oldModified);
    }
    serialize() { return this.serializedState; }
    getAuthor() { return this.author; }
    ;
    getEditorState() { return this.editorState; }
    ;
}
exports.ModifiedDelta = ModifiedDelta;
class EditorState {
    constructor(suppliedState, editorWrapper, userList, mustPerformChange) {
        this.editorWrapper = editorWrapper;
        this.userList = userList;
        this.deltas = [];
        this.selections = {};
        this.remoteCursors = new RemoteCursorMarker(this);
        this.deltaPointer = -1;
        this.currentTimestamp = CURRENT;
        let state = _.extend({
            isOpen: true,
            deltas: [],
            cursors: []
        }, suppliedState);
        this.isOpen = state.isOpen;
        this.title = state.title;
        this.editorWrapper.setEditorState(this);
        this.editorID = state.id;
        if (mustPerformChange) {
            state.deltas.forEach((d) => {
                this.addDelta(d, true);
            });
        }
        state.cursors.forEach((c) => { });
    }
    serialize() {
        return {
            deltas: _.map(this.getDeltas(), d => d.serialize()),
            isOpen: this.isOpen,
            id: this.editorID,
            title: this.title,
            modified: this.modified,
            remoteCursors: this.remoteCursors.serialize()
        };
    }
    ;
    getDeltas() { return this.deltas; }
    ;
    setTitle(newTitle) { this.title = newTitle; }
    ;
    setIsOpen(val) { this.isOpen = val; }
    ;
    setIsModified(val) { this.modified = val; }
    ;
    getEditorWrapper() { return this.editorWrapper; }
    ;
    getTitle() { return this.title; }
    ;
    getIsOpen() { return this.isOpen; }
    ;
    getRemoteCursors() { return this.remoteCursors; }
    ;
    getEditorID() { return this.editorID; }
    ;
    getIsModified() { return this.modified; }
    ;
    addHighlight(range, extraInfo) {
        return this.getEditorWrapper().addHighlight(range, extraInfo);
    }
    removeHighlight(highlightID, extraInfo) {
        return this.getEditorWrapper().removeHighlight(highlightID, extraInfo);
    }
    focus(range, extraInfo) {
        return this.getEditorWrapper().focus(range, extraInfo);
    }
    moveDeltaPointer(index) {
        let d;
        const editorWrapper = this.getEditorWrapper();
        if (this.deltaPointer < index) {
            while (this.deltaPointer < index) {
                this.deltaPointer++;
                d = this.deltas[this.deltaPointer];
                d.doAction(editorWrapper);
            }
        }
        else if (this.deltaPointer > index) {
            while (this.deltaPointer > index) {
                d = this.deltas[this.deltaPointer];
                d.undoAction(editorWrapper);
                this.deltaPointer--;
            }
        }
    }
    getLastDeltaIndexBeforeTimestamp(timestamp) {
        let d;
        let i = 0;
        for (; i < this.deltas.length; i++) {
            d = this.deltas[i];
            if (d.getTimestamp() > timestamp) {
                break;
            }
        }
        return i - 1;
    }
    revertToTimestamp(timestamp, extraInfo) {
        const editorWrapper = this.getEditorWrapper();
        if (timestamp) {
            editorWrapper.setReadOnly(true, extraInfo);
            const lastDeltaBefore = this.getLastDeltaIndexBeforeTimestamp(timestamp);
            this.moveDeltaPointer(lastDeltaBefore);
        }
        else {
            editorWrapper.setReadOnly(false, extraInfo);
            this.moveDeltaPointer(this.deltas.length - 1);
        }
    }
    getTextBeforeDelta(delta, asLines = false) {
        return this.getTextAfterIndex(this.getDeltaIndex(delta) - 1, asLines);
    }
    getTextAfterDelta(delta, asLines = false) {
        return this.getTextAfterIndex(this.getDeltaIndex(delta), asLines);
    }
    ;
    getDeltaIndex(delta) {
        return this.deltas.indexOf(delta);
    }
    getTextAfterIndex(index, asLines) {
        const cmInterface = {
            editor: CodeMirror(null),
            setText: function (value) {
                this.editor.setValue(value);
            },
            replaceText: function (range, value) {
                this.editor.replaceRange(value, {
                    line: range.start[0],
                    ch: range.start[1]
                }, {
                    line: range.end[0],
                    ch: range.end[1]
                });
            },
            getValue: function () {
                return this.editor.getValue();
            },
            getLines: function () {
                let lines = [];
                const doc = this.editor.getDoc();
                doc.eachLine((l) => {
                    lines.push(doc.getLine(doc.getLineNumber(l)));
                });
                return lines;
            },
            destroy: function () {
                this.editor.clearHistory();
            }
        };
        for (let i = 0; i <= index; i++) {
            const delta = this.deltas[i];
            if (delta instanceof OpenDelta) {
                const oDelta = delta;
                cmInterface.setText(oDelta.getContents());
            }
            else if (delta instanceof EditDelta) {
                const eDelta = delta;
                eDelta.getChanges().forEach((c) => {
                    cmInterface.replaceText(c.getOldRange(), c.getNewText());
                });
            }
            else {
                continue;
            }
        }
        const value = asLines ? cmInterface.getLines() : cmInterface.getValue();
        cmInterface.destroy();
        return value;
    }
    addDelta(serializedDelta, mustPerformChange) {
        const { type } = serializedDelta;
        const author = this.userList.getUser(serializedDelta.uid);
        let delta;
        if (type === 'open') {
            delta = new OpenDelta(serializedDelta, author, this);
        }
        else if (type === 'edit') {
            delta = new EditDelta(serializedDelta, author, this);
        }
        else if (type === 'modified') {
            delta = new ModifiedDelta(serializedDelta, author, this);
        }
        else if (type === 'grammar') {
            delta = new GrammarDelta(serializedDelta, author, this);
        }
        else if (type === 'title') {
            delta = new TitleDelta(serializedDelta, author, this);
        }
        else if (type === 'destroy') {
            delta = new DestroyDelta(serializedDelta, author, this);
        }
        else {
            delta = null;
            console.log(serializedDelta);
        }
        if (delta) {
            this.handleDelta(delta, mustPerformChange);
        }
        return delta;
    }
    handleDelta(delta, mustPerformChange) {
        const oldDeltaPointer = this.deltaPointer;
        //Go back and undo any deltas that should have been done after this delta
        const lastDeltaBefore = this.getLastDeltaIndexBeforeTimestamp(delta.getTimestamp());
        if (oldDeltaPointer < 0 || oldDeltaPointer >= lastDeltaBefore) {
            this.moveDeltaPointer(lastDeltaBefore);
            this.deltas.splice(this.deltaPointer + 1, 0, delta);
            if (mustPerformChange === false) {
                this.deltaPointer = this.deltaPointer + 1; // will not include this delta as we move forward
            }
        }
        else {
            this.deltas.splice(lastDeltaBefore + 1, 0, delta);
        }
        // Go forward and do all of the deltas that come after.
        this.updateDeltaPointer();
    }
    removeUserCursors(user) {
        this.remoteCursors.removeUserCursors(user);
    }
    getCurrentTimestamp() { return this.currentTimestamp; }
    setCurrentTimestamp(timestamp, extraInfo) {
        const editorWrapper = this.getEditorWrapper();
        this.currentTimestamp = timestamp;
        editorWrapper.setReadOnly(!this.isLatestTimestamp(), extraInfo);
        this.updateDeltaPointer();
    }
    ;
    updateDeltaPointer() {
        if (this.isLatestTimestamp()) {
            this.moveDeltaPointer(this.deltas.length - 1);
        }
        else {
            const lastDeltaBefore = this.getLastDeltaIndexBeforeTimestamp(this.getCurrentTimestamp());
            this.moveDeltaPointer(lastDeltaBefore);
        }
    }
    ;
    isLatestTimestamp() {
        return this.getCurrentTimestamp() === CURRENT;
    }
    ;
    hasDeltaAfter(timestamp) {
        return _.last(this.getDeltas()).getTimestamp() > timestamp;
    }
    ;
}
exports.EditorState = EditorState;
class EditorStateTracker extends events_1.EventEmitter {
    constructor(EditorWrapperClass, channelCommunicationService, userList) {
        super();
        this.EditorWrapperClass = EditorWrapperClass;
        this.channelCommunicationService = channelCommunicationService;
        this.userList = userList;
        this.editorStates = new Map();
        this.currentTimestamp = CURRENT;
        this.channelCommunicationService.getShareDBEditors().then((editorDoc) => {
            editorDoc.data.forEach((li) => {
                this.onEditorOpened(li, true);
            });
            editorDoc.on('op', (ops) => {
                ops.forEach((op) => {
                    const { p } = op;
                    if (p.length === 1) {
                        if (_.has(op, 'li')) {
                            const { li } = op;
                            this.onEditorOpened(li, true);
                        }
                    }
                });
            });
        });
        this.channelCommunicationService.getShareDBCursors().then((cursorsDoc) => {
            _.each(cursorsDoc.data, (cursorInfo, editorID) => {
                const editor = this.getEditorState(editorID);
                const remoteCursors = editor.getRemoteCursors();
                _.each(cursorInfo['userCursors'], (cursorInfo, userID) => {
                    const { newBufferPosition } = cursorInfo;
                    const user = this.userList.getUser(userID);
                    if (user) {
                        remoteCursors.updateCursor(user.getID(), user, newBufferPosition);
                    }
                });
                _.each(cursorInfo['userSelections'], (selectionInfo, userID) => {
                    const { newRange } = selectionInfo;
                    const user = this.userList.getUser(userID);
                    if (user) {
                        remoteCursors.updateSelection(user.getID(), user, newRange);
                    }
                });
            });
            cursorsDoc.on('op', (ops) => {
                ops.forEach((op) => {
                    const { p, oi, od } = op;
                    const editorID = p[0];
                    const editor = this.getEditorState(editorID);
                    if (editor) {
                        const remoteCursors = editor.getRemoteCursors();
                        if (p.length === 3) {
                            const isUserCursor = p[1] === 'userCursors';
                            const isUserSelection = p[1] === 'userSelections';
                            const userID = p[2];
                            const user = this.userList.getUser(userID);
                            if (oi) {
                                if (isUserCursor) {
                                    remoteCursors.updateCursor(user.getID(), user, oi['newBufferPosition']);
                                }
                                else if (isUserSelection) {
                                    remoteCursors.updateSelection(user.getID(), user, oi['newRange']);
                                }
                            }
                            else if (od) {
                                remoteCursors.removeUserCursors(user);
                            }
                        }
                        else if (p.length === 1) {
                            _.each(cursorsDoc.data[editorID]['userCursors'], (cursorInfo, userID) => {
                                const { newBufferPosition } = cursorInfo;
                                const user = this.userList.getUser(userID);
                                remoteCursors.updateCursor(user.getID(), user, newBufferPosition);
                            });
                            _.each(cursorsDoc.data[editorID]['userSelections'], (selectionInfo, userID) => {
                                const { newRange } = selectionInfo;
                                const user = this.userList.getUser(userID);
                                remoteCursors.updateSelection(user.getID(), user, newRange);
                            });
                        }
                    }
                    else {
                        console.error(`Could not find editor ${editorID}`);
                    }
                });
            });
            // if(p.length === 3) {
            // 	const editorID = editorDoc.data[p[0]]['id'];
            // 	const editor = this.getEditorState(editorID);
            // 	const isUserCursor:boolean = p[1] === 'userCursors';
            // 	const isUserSelection:boolean = p[1] === 'userSelections';
            //
            // 	if(isUserCursor || isUserSelection) {
            // 		const remoteCursors = editor.getRemoteCursors();
            // 		const userID:string = p[2];
            // 		const user = this.userList.getUser(userID);
            // 		const {oi, od} = op;
            // 		if(oi) {
            // 			if(isUserCursor) {
            // 				remoteCursors.updateCursor(user.getID(), user, oi.newBufferPosition);
            // 			} else if(isUserSelection) {
            // 				remoteCursors.updateSelection(user.getID(), user, oi.newRange);
            // 			}
            // 		} else if(od) {
            // 			remoteCursors.removeUserCursors(user);
            // 		}
            // 	}
            // }
        });
    }
    createEditor(id, title, contents, grammarName, modified) {
        this.channelCommunicationService.getShareDBEditors().then((editorDoc) => {
            const data = { title, id, contents, grammarName, modified, userCursors: {}, userSelections: {} };
            editorDoc.submitOp({ p: [editorDoc.data.length], li: data });
            this.onEditorOpened(data, true);
        });
    }
    getAllEditors() {
        return Array.from(this.editorStates.values());
    }
    handleEvent(event, mustPerformChange) {
        const editorState = this.getEditorState(event.id);
        if (editorState) {
            return editorState.addDelta(event, mustPerformChange);
        }
        return null;
    }
    ;
    getEditorState(editorID) {
        if (this.editorStates.has(editorID)) {
            return this.editorStates.get(editorID);
        }
        else {
            return null;
        }
    }
    getActiveEditors() {
        const rv = _.filter(this.getAllEditors(), s => s.getIsOpen());
        return rv;
    }
    onEditorOpened(state, mustPerformChange) {
        const { id } = state;
        if (this.editorStates.has(id)) {
            return this.editorStates.get(id);
        }
        else {
            const editorState = new EditorState(state, new this.EditorWrapperClass(state, this.channelCommunicationService), this.userList, mustPerformChange);
            this.editorStates.set(id, editorState);
            return editorState;
        }
    }
    removeUserCursors(user) {
        this.editorStates.forEach((es) => {
            es.removeUserCursors(user);
        });
    }
    hasDeltaAfter(timestamp) {
        return _.any(this.getAllEditors(), (e) => e.hasDeltaAfter(timestamp));
    }
    ;
    addHighlight(editorID, range, timestamp, extraInfo = {}) {
        this.setCurrentTimestamp(timestamp, extraInfo);
        const editorState = this.getEditorState(editorID);
        if (editorState) {
            return editorState.addHighlight(range, extraInfo);
        }
        else {
            return -1;
        }
    }
    removeHighlight(editorID, highlightID, extraInfo = {}) {
        const editorState = this.getEditorState(editorID);
        if (editorState) {
            return editorState.removeHighlight(highlightID, extraInfo);
        }
        else {
            return false;
        }
    }
    focus(editorID, range, timestamp, extraInfo = {}) {
        this.setCurrentTimestamp(timestamp, extraInfo);
        const editorState = this.getEditorState(editorID);
        if (editorState) {
            return editorState.focus(range, extraInfo);
        }
        else {
            return false;
        }
    }
    fuzzyMatch(query) {
        const editors = this.getAllEditors();
        const editorTitleSet = new FuzzySet(_.map(editors, (e) => e.getTitle()));
        const matches = editorTitleSet.get(query);
        if (matches) {
            const bestTitleMatch = matches[0][1];
            const matchingTitles = _.filter(this.getAllEditors(), (es) => es.getTitle() === bestTitleMatch);
            if (matchingTitles.length > 0) {
                return matchingTitles[0];
            }
        }
        return null;
    }
    ;
    getCurrentTimestamp() {
        return this.currentTimestamp;
    }
    ;
    setCurrentTimestamp(timestamp, extraInfo) {
        if (timestamp !== CURRENT && !this.hasDeltaAfter(timestamp)) {
            timestamp = CURRENT;
        }
        this.currentTimestamp = timestamp;
        _.each(this.getAllEditors(), (e) => {
            e.setCurrentTimestamp(timestamp, extraInfo);
        });
        this.emit('timestampChanged', {
            timestamp: timestamp
        });
    }
    ;
    toLatestTimestamp(extraInfo) {
        return this.setCurrentTimestamp(CURRENT, extraInfo);
    }
    ;
    goBeforeDelta(delta, extraInfo) {
        this.setCurrentTimestamp(delta.getTimestamp() - 1, extraInfo);
    }
    ;
    goAfterDelta(delta, extraInfo) {
        this.setCurrentTimestamp(delta.getTimestamp() + 1, extraInfo);
    }
    ;
    isAtLatest() {
        return this.getCurrentTimestamp() === CURRENT;
    }
    ;
    isShowingCodeBefore(delta) {
        return this.getCurrentTimestamp() === delta.getTimestamp() - 1;
    }
    isShowingCodeAfter(delta) {
        return this.getCurrentTimestamp() === delta.getTimestamp() + 1;
    }
}
exports.EditorStateTracker = EditorStateTracker;
//# sourceMappingURL=editor-state-tracker.js.map