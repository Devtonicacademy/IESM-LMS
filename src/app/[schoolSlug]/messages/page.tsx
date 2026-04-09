"use client";

import { use, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Send, Search, User as UserIcon, BookOpen, ShieldAlert, MessageSquarePlus } from "lucide-react";
import { format } from "date-fns";

type ChatType = "course" | "direct" | "anonymous";

interface ChatSession {
  id: string;
  type: ChatType;
  title: string;
  subtitle?: string;
  updatedAt?: any;
  // Internal fields to direct usage
  courseId?: string;
  otherUserId?: string;
  participants?: string[];
  isAnon?: boolean;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: any;
  isAnon?: boolean;
}

interface SchoolUser {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

export default function MessagesPage({ params }: { params: Promise<{ schoolSlug: string }> }) {
  const { schoolSlug } = use(params);
  const { user, isAdmin, isSuperAdmin, isInstructor } = useAuth();
  const router = useRouter();

  const [activeChat, setActiveChat] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // States for lists
  const [courseChats, setCourseChats] = useState<ChatSession[]>([]);
  const [directChats, setDirectChats] = useState<ChatSession[]>([]);
  const [anonChats, setAnonChats] = useState<ChatSession[]>([]);

  // Dialog for new chat
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [usersList, setUsersList] = useState<SchoolUser[]>([]);
  const [searchUser, setSearchUser] = useState("");

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load chat lists
  useEffect(() => {
    if (!user) return;

    // 1. Load Courses the user has access to
    const coursesRef = collection(db, "schools", schoolSlug, "courses");
    let coursesQuery = coursesRef as any;
    if (!isAdmin && !isSuperAdmin) {
      if (isInstructor) {
        coursesQuery = query(coursesRef, where("instructorId", "==", user.uid));
      } else {
        coursesQuery = query(coursesRef, where("enrolledStudents", "array-contains", user.uid));
      }
    }
    
    // For simplicity if we can't do complex ORs, we just fetch all and filter client side if needed,
    // but the above works for student and instructor. If admin, gets all.
    const unsubCourses = onSnapshot(coursesQuery, (snap: any) => {
      const c = snap.docs.map((doc: any) => ({
        id: `course_${doc.id}`,
        type: "course" as ChatType,
        title: doc.data().title || "Untitled Course",
        subtitle: "Group Chat",
        courseId: doc.id,
        updatedAt: doc.data().updatedAt || { seconds: 0 },
      }));
      setCourseChats(c);
    });

    // 2. Load Direct & Anon Chats
    const chatsRef = collection(db, "schools", schoolSlug, "chats");
    const chatsQuery = query(chatsRef, where("participants", "array-contains", user.uid), orderBy("updatedAt", "desc"));
    
    const unsubChats = onSnapshot(chatsQuery, (snap: any) => {
      const d: ChatSession[] = [];
      const a: ChatSession[] = [];
      snap.docs.forEach((doc: any) => {
        const data = doc.data();
        const otherUserId = data.participants.find((p: string) => p !== user.uid) || user.uid;
        
        const chatSes: ChatSession = {
          id: doc.id,
          type: data.type || "direct",
          title: data.participantNames ? (data.participantNames[otherUserId] || "Unknown") : "Chat",
          subtitle: data.type === "anonymous" ? "Anonymous Report" : "Direct Message",
          updatedAt: data.updatedAt,
          otherUserId,
          participants: data.participants,
          isAnon: data.isAnon,
        };

        // For anonymity: if user is student acting anonymously
        if (data.type === "anonymous") {
            if (isAdmin || isSuperAdmin) {
                // Admin sees it as Anonymous Student
                chatSes.title = "Anonymous Student";
            } else {
                chatSes.title = "Report to Admin";
            }
            a.push(chatSes);
        } else {
            d.push(chatSes);
        }
      });
      setDirectChats(d);
      setAnonChats(a);
    });

    return () => {
      unsubCourses();
      unsubChats();
    };
  }, [user, schoolSlug, isAdmin, isSuperAdmin, isInstructor]);

  // Load Active Chat Messages
  useEffect(() => {
    if (!activeChat || !user) return;
    
    let messagesRef;
    if (activeChat.type === "course") {
      messagesRef = collection(db, "schools", schoolSlug, "courses", activeChat.courseId!, "messages");
    } else {
      messagesRef = collection(db, "schools", schoolSlug, "chats", activeChat.id, "messages");
    }

    const q = query(messagesRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap: any) => {
      setMessages(
        snap.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    });
    return () => unsub();
  }, [activeChat, schoolSlug, user]);

  // Fetch users for new chat
  useEffect(() => {
    if (newChatOpen && user) {
      const q = query(collection(db, "schools", schoolSlug, "users"), orderBy("displayName"));
      getDocs(q).then((snap) => {
        const u = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as SchoolUser))
          .filter(u => u.id !== user.uid);
        setUsersList(u);
      });
    }
  }, [newChatOpen, schoolSlug, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChat || !user) return;

    const text = inputText.trim();
    setInputText("");

    try {
      const msgData: any = {
        text,
        senderId: user.uid,
        senderName: user.displayName || "User",
        createdAt: serverTimestamp(),
      };

      if (activeChat.type === "anonymous" && !isAdmin && !isSuperAdmin) {
        msgData.senderName = "Anonymous Student";
        msgData.isAnon = true;
      }

      if (activeChat.type === "course") {
        await addDoc(collection(db, "schools", schoolSlug, "courses", activeChat.courseId!, "messages"), msgData);
      } else {
        await addDoc(collection(db, "schools", schoolSlug, "chats", activeChat.id, "messages"), msgData);
        await setDoc(doc(db, "schools", schoolSlug, "chats", activeChat.id), {
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      console.error("Failed to send message", error);
      toast.error("Failed to send message.");
    }
  };

  const startDirectChat = async (targetUser: SchoolUser) => {
    if (!user) return;
    setNewChatOpen(false);
    
    // Check if chat exists
    const existing = directChats.find(c => c.participants?.includes(targetUser.id));
    if (existing) {
      setActiveChat(existing);
      return;
    }

    try {
      const newChatRef = doc(collection(db, "schools", schoolSlug, "chats"));
      await setDoc(newChatRef, {
        type: "direct",
        participants: [user.uid, targetUser.id],
        participantNames: {
          [user.uid]: user.displayName || "User",
          [targetUser.id]: targetUser.displayName || targetUser.email,
        },
        updatedAt: serverTimestamp(),
      });
      setActiveChat({
        id: newChatRef.id,
        type: "direct",
        title: targetUser.displayName || targetUser.email,
        subtitle: "Direct Message",
        participants: [user.uid, targetUser.id]
      });
    } catch (e) {
      toast.error("Failed to start chat.");
    }
  };

  const startAnonymousReport = async () => {
    if (!user) return;
    setNewChatOpen(false);

    // Find any admin to send to (fetch one admin or a generic 'admins' chat).
    // For simplicity, let's create a chat where the other participant is a generic "admins" identifier.
    // Realistically, we find all admins and add them, or let admins query for participants containing 'admin'.
    // Here we will use 'admin_group' as the other user ID so all admins can see it.
    
    // Wait, admins might not be in the 'participants' array if it's dynamic. 
    // We can just add all current admin IDs to participants, plus the student.
    const adminsSnap = await getDocs(query(collection(db, "schools", schoolSlug, "users"), where("role", "in", ["admin", "super-admin"])));
    const adminIds = adminsSnap.docs.map(d => d.id);
    
    if (adminIds.length === 0) {
        toast.error("No admins available to report to.");
        return;
    }

    try {
      const newChatRef = doc(collection(db, "schools", schoolSlug, "chats"));
      await setDoc(newChatRef, {
        type: "anonymous",
        participants: [user.uid, ...adminIds],
        participantNames: {
          [user.uid]: "Anonymous Student", // Hide real name
        },
        updatedAt: serverTimestamp(),
      });
      setActiveChat({
        id: newChatRef.id,
        type: "anonymous",
        title: "Report to Admin",
        subtitle: "Anonymous message",
        participants: [user.uid, ...adminIds]
      });
      toast.success("Anonymous chat started.");
    } catch (e) {
      toast.error("Failed to start anonymous chat.");
    }
  };

  const formatTime = (ts: any) => {
    if (!ts) return "";
    return format(new Date(ts.seconds * 1000), "HH:mm");
  };

  const filteredUsers = usersList.filter(u => 
      u.displayName?.toLowerCase().includes(searchUser.toLowerCase()) || 
      u.email?.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden w-full bg-background">
      <DashboardTopbar breadcrumb="Messages" />
      
      <div className="flex flex-1 overflow-hidden p-4 gap-4 max-w-7xl mx-auto w-full">
        
        {/* Sidebar */}
        <div className="w-80 flex flex-col bg-card border rounded-2xl overflow-hidden shadow-sm shrink-0">
          <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
            <h2 className="font-semibold text-lg">Chats</h2>
            <Button size="icon" variant="ghost" onClick={() => setNewChatOpen(true)}>
              <MessageSquarePlus className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-6">
            
            {/* Courses */}
            {courseChats.length > 0 && (
              <div className="space-y-1">
                <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Courses</p>
                {courseChats.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveChat(c)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-xl transition-colors text-left",
                      activeChat?.id === c.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    )}
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Direct */}
            {directChats.length > 0 && (
              <div className="space-y-1">
                <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Direct Messages</p>
                {directChats.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveChat(c)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-xl transition-colors text-left",
                      activeChat?.id === c.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={`https://api.dicebear.com/7.x/notionists/svg?seed=${c.id}`} />
                      <AvatarFallback><UserIcon className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Anonymous */}
            {anonChats.length > 0 && (
              <div className="space-y-1">
                <p className="px-2 text-xs font-semibold text-rose-500/80 uppercase tracking-wider mb-2">Anonymous Reports</p>
                {anonChats.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveChat(c)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-xl transition-colors text-left",
                      activeChat?.id === c.id ? "bg-rose-500/10 text-rose-600" : "hover:bg-rose-50 dark:hover:bg-rose-950/20"
                    )}
                  >
                    <div className="h-10 w-10 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0">
                      <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{c.title}</p>
                      <p className="text-xs text-rose-600/70 truncate">{c.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-card border rounded-2xl shadow-sm overflow-hidden relative">
          {activeChat ? (
            <>
              {/* Header */}
              <div className="h-16 px-6 border-b flex items-center gap-4 bg-muted/10 shrink-0">
                {activeChat.type === 'course' ? (
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                ) : activeChat.type === 'anonymous' ? (
                  <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center">
                    <ShieldAlert className="h-5 w-5 text-rose-600" />
                  </div>
                ) : (
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={`https://api.dicebear.com/7.x/notionists/svg?seed=${activeChat.id}`} />
                    <AvatarFallback><UserIcon className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                )}
                <div>
                  <h3 className="font-bold text-lg">{activeChat.title}</h3>
                  <p className="text-xs text-muted-foreground">{activeChat.subtitle}</p>
                </div>
              </div>

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/5">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <MessageSquarePlus className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>No messages yet. Say hi!</p>
                    </div>
                  </div>
                ) : (
                  messages.map((m, i) => {
                    const isMe = m.senderId === user?.uid;
                    const showHeader = i === 0 || messages[i-1].senderId !== m.senderId;

                    return (
                      <div key={m.id} className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}>
                        <div className={cn("flex flex-col gap-1 max-w-[75%]", isMe && "items-end")}>
                          {showHeader && (
                            <div className="flex items-center gap-2 mb-1 px-1">
                                {!isMe && <span className="text-xs font-semibold text-muted-foreground">{m.senderName}</span>}
                                {isMe && <span className="text-xs font-semibold text-muted-foreground">You</span>}
                            </div>
                          )}
                          <div
                            className={cn(
                              "px-4 py-2.5 rounded-2xl relative group",
                              isMe 
                                ? "bg-primary text-primary-foreground rounded-tr-sm" 
                                : activeChat.type === 'anonymous' 
                                    ? "bg-rose-500 text-white rounded-tl-sm"
                                    : "bg-muted rounded-tl-sm text-foreground shadow-sm border border-border/50"
                            )}
                          >
                            <p className="text-sm break-words whitespace-pre-wrap">{m.text}</p>
                            <span className={cn(
                                "text-[10px] mt-1 block opacity-70",
                                isMe ? "text-right" : "text-left"
                            )}>
                                {formatTime(m.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-background border-t">
                <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      placeholder={activeChat.type === 'anonymous' ? "Write an anonymous message..." : "Type your message..."}
                      className="rounded-full pl-5 pr-12 h-12 bg-muted/50 border-transparent focus-visible:ring-primary/50"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    size="icon" 
                    className={cn(
                        "h-12 w-12 rounded-full shrink-0 shadow-md",
                        activeChat.type === 'anonymous' && "bg-rose-600 hover:bg-rose-700"
                    )} 
                    disabled={!inputText.trim()}
                  >
                    <Send className="h-5 w-5 ml-1" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center max-w-sm">
                <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquarePlus className="h-10 w-10 opacity-40" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Your Messages</h3>
                <p className="text-sm mb-6">Select a conversation from the sidebar or start a new one to connect with students, instructors, or admins.</p>
                <Button onClick={() => setNewChatOpen(true)} className="rounded-full shadow-sm">
                  Start a Conversation
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Dialog */}
      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="sm:max-w-md h-[80vh] sm:h-auto flex flex-col">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
          </DialogHeader>
          
          <div className="relative py-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search users..." 
              className="pl-9 h-10 rounded-xl bg-muted/50"
              value={searchUser}
              onChange={e => setSearchUser(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 -mx-2 px-2 py-2">
            {!isAdmin && !isSuperAdmin && (
              <button
                onClick={startAnonymousReport}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20 text-left transition-colors mb-4 border border-rose-100 dark:border-rose-900/50"
              >
                <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <ShieldAlert className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Report to Admin (Anonymous)</p>
                  <p className="text-xs text-rose-600/80">Send a secure, anonymous message to school administrators.</p>
                </div>
              </button>
            )}

            {filteredUsers.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-8">No users found.</p>
            ) : (
                filteredUsers.map(u => (
                <button
                    key={u.id}
                    onClick={() => startDirectChat(u)}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted text-left transition-colors"
                >
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={`https://api.dicebear.com/7.x/notionists/svg?seed=${u.id}`} />
                        <AvatarFallback>{u.displayName?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{u.displayName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{u.role}</p>
                    </div>
                </button>
                ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
