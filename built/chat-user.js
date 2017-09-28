"use strict";
const _ = require("underscore");
const events_1 = require("events");
/*
 * Represents a single chat user
 */
class ChatUser extends events_1.EventEmitter {
    /**
     * constructor
     * @param  {boolean} isMe       Whether the user is me or not
     * @param  {string}  id         The unique id
     * @param  {string}  name       The display name
     * @param  {boolean} active     Whether this user is currently in the channel
     * @param  {number}  colorIndex The user's color
     */
    constructor(isMe, id, name, joined, left, colorIndex) {
        super();
        this.isMe = isMe;
        this.id = id;
        this.name = name;
        this.joined = joined;
        this.left = left;
        this.colorIndex = colorIndex;
        this.typingStatus = 'IDLE';
    }
    getIsMe() { return this.isMe; }
    ;
    // public isActive():boolean { return this.active; };
    getID() { return this.id; }
    getName() { return this.name; }
    getColorIndex() { return this.colorIndex; }
    ;
    // public setIsActive(active:boolean):void { this.active = active; };
    getTypingStatus() { return this.typingStatus; }
    ;
    setLeft(ts) { this.left = ts; }
    ;
    getLeft() { return this.left; }
    ;
    getJoined() { return this.joined; }
    ;
    setTypingStatus(status) {
        this.typingStatus = status;
        this.emit('typingStatus', {
            status: status
        });
    }
    serialize() {
        return {
            id: this.id,
            name: this.name,
            typingStatus: this.typingStatus
        };
    }
}
exports.ChatUser = ChatUser;
class ChatUserList extends events_1.EventEmitter {
    constructor(myIDPromise, channelService) {
        super();
        this.myIDPromise = myIDPromise;
        this.channelService = channelService;
        this.activeUsers = new Map();
        this.allUsers = new Map();
        this.chatDocPromise = this.channelService.getShareDBChat();
        this.ready = Promise.all([this.chatDocPromise, this.myIDPromise]).then((info) => {
            // const [doc, myID] = info;
            const doc = info[0];
            const myID = info[1];
            // const [doc:sharedb.Doc, myID:string] = info;
            // console.log(doc);
            _.each(doc.data.allUsers, (oi) => {
                this.allUsers.set(oi.id, this.createUser(oi, myID));
            });
            _.each(doc.data.activeUsers, (oi) => {
                this.activeUsers.set(oi.id, this.createUser(oi, myID));
            });
            doc.on('op', (ops, source) => {
                ops.forEach((op) => {
                    const { p } = op;
                    const [field] = p;
                    if (field === 'activeUsers' || field === 'allUsers') {
                        const userMap = field === 'activeUsers' ? this.activeUsers : this.allUsers;
                        if (_.has(op, 'od') && _.has(op, 'oi')) {
                            const { od, oi } = op;
                            if (od.id !== oi.id) {
                                const addedUser = this.createUser(oi, myID);
                                userMap.delete(od.id);
                                this.emit('userRemoved', {
                                    id: od.id
                                });
                                userMap.set(oi.id, addedUser);
                                this.emit('userAdded', {
                                    user: addedUser
                                });
                            }
                        }
                        else if (_.has(op, 'od')) {
                            const { od } = op;
                            const { id } = od;
                            userMap.delete(id);
                            this.emit('userRemoved', {
                                id: id
                            });
                        }
                        else if (_.has(op, 'oi')) {
                            const { oi } = op;
                            const addedUser = this.createUser(oi, myID);
                            userMap.set(oi.id, addedUser);
                            this.emit('userAdded', {
                                user: addedUser
                            });
                        }
                    }
                });
            });
        }).then(() => {
            return true;
        });
    }
    createUser(userInfo, myID) {
        const { id, joined, left, info } = userInfo;
        let user = this.allUsers.get(id);
        if (!user) {
            const { name, colorIndex } = info;
            const isMe = (id === myID);
            user = new ChatUser(isMe, id, name, joined, left, colorIndex);
        }
        return user;
    }
    ;
    getUser(id) {
        return this.allUsers.get(id);
    }
    getMe() {
        const activeUsers = this.getActiveUsers();
        for (let i = 0; i < activeUsers.length; i++) {
            let user = activeUsers[i];
            if (user.getIsMe()) {
                return user;
            }
        }
        return null;
    }
    getActiveUsers() {
        // return [];
        return Array.from(this.activeUsers.values());
    }
}
exports.ChatUserList = ChatUserList;
//# sourceMappingURL=chat-user.js.map