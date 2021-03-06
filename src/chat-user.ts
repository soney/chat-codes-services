import * as _ from 'underscore';
import { EventEmitter } from './event';
import { ChannelCommunicationService } from './communication-service';
import * as ShareDB from 'sharedb/lib/client';

/*
 * Represents a single chat user
 */
export class ChatUser extends EventEmitter {
    private chatDocPromise:Promise<ShareDB.Doc>;
    /**
     * constructor
     * @param  {boolean} isMe       Whether the user is me or not
     * @param  {string}  id         The unique id
     * @param  {string}  name       The display name
     * @param  {boolean} active     Whether this user is currently in the channel
     * @param  {number}  colorIndex The user's color
     */
    constructor(private isMe:boolean, private id:string, private name:string, private joined:number, private left:number, private colorIndex:number, private channelService:ChannelCommunicationService) {
        super();
        this.chatDocPromise = this.channelService.getShareDBChat();
    }
    private typingStatus:string='IDLE';
    public getIsMe():boolean { return this.isMe; };
    public getID():string { return this.id; }
    public getName():string { return this.name; }
    public getColorIndex():number { return this.colorIndex; };
    public getTypingStatus():string { return this.typingStatus; };
    public setLeft(ts:number) { this.left = ts; };
    public getLeft():number { return this.left; };
    public getJoined():number { return this.joined; };

    public setTypingStatus(status:string) {
        this.typingStatus = status;
        (this as any).emit('typingStatus', {
            status: status
        });
    }
}

export class ChatUserList extends EventEmitter {
    private activeUsers:Map<string, ChatUser>=new Map();
    private allUsers:Map<string, ChatUser>=new Map();
    private chatDocPromise:Promise<ShareDB.Doc>;
    public ready:Promise<boolean>;
    constructor(private myIDPromise:Promise<string>, private channelService:ChannelCommunicationService) {
        super();
        this.chatDocPromise = this.channelService.getShareDBChat();
        this.ready = Promise.all([this.chatDocPromise, this.myIDPromise]).then((info) => {
            const doc:ShareDB.Doc = info[0];
            const myID:string = info[1];
            _.each(doc.data.allUsers, (oi:any) => {
                this.allUsers.set(oi.id, this.createUser(oi, myID));
            });
            _.each(doc.data.activeUsers, (oi:any) => {
                this.activeUsers.set(oi.id, this.createUser(oi, myID));
            });

            doc.on('op', (ops, source) => {
                ops.forEach((op) => {
                    const {p} = op;
                    const [field] = p;
                    if((field === 'activeUsers' || field === 'allUsers') && (p.length === 2)) {
                        const userMap:Map<string,ChatUser> = field==='activeUsers' ? this.activeUsers : this.allUsers;

                        if(_.has(op, 'od') && _.has(op, 'oi')) {
                            const {od, oi} = op;
                            if(od.id !== oi.id) {
                                const addedUser = this.createUser(oi, myID);
                                userMap.delete(od.id);
                                (this as any).emit('userRemoved', {
                                    id: od.id
                                });
                                userMap.set(oi.id, addedUser);
                                (this as any).emit('userAdded', {
                                    user: addedUser
                                });
                            }
                        } else if (_.has(op, 'od')) {
                            const {od} = op;
                            const {id} = od;
                            userMap.delete(id);
                            (this as any).emit('userRemoved', {
                                id: id
                            });
                        } else if (_.has(op, 'oi')) {
                            const {oi} = op;
                            const addedUser = this.createUser(oi, myID);

                            userMap.set(oi.id, addedUser);
                            (this as any).emit('userAdded', {
                                user: addedUser
                            });
                        }
                    } else if (_.last(p) === 'typingStatus') {
                        if(_.has(op, 'oi')) {
                            const {oi} = op;
                            const uid:string = p[1];
                            const user = this.getUser(uid);
                            user.setTypingStatus(oi);
                        }
                    } else {
                        // console.log(p);
                    }
                });
            });
        }).then(() => {
            return true;
        });
    }
    private createUser(userInfo, myID):ChatUser {
        const {id, joined, left, info} = userInfo;

        if(this.allUsers.has(id)) {
            const user:ChatUser = this.allUsers.get(id);
            return user;
        } else {
            const {name, colorIndex} = info;
            const isMe = (id === myID);
            const user:ChatUser = new ChatUser(isMe, id, name, joined, left, colorIndex, this.channelService);
            this.allUsers.set(id, user);
            return user;
        }
    };
    public getUser(id:string):ChatUser {
        return this.allUsers.get(id);
    }
    public getMe():ChatUser {
        const activeUsers = this.getActiveUsers();
        for(let i = 0; i<activeUsers.length; i++) {
            let user = activeUsers[i];
            if(user.getIsMe()) { return user; }
        }
        return null;
    }
    public getActiveUsers():Array<ChatUser> {
        return Array.from(this.activeUsers.values());
    }
}
