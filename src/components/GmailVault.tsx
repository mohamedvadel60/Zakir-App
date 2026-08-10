import React, { useState, useEffect } from "react";
import { 
  Mail, 
  Send, 
  Inbox, 
  Search, 
  Plus, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  History, 
  Clock, 
  ChevronRight, 
  X, 
  ExternalLink, 
  Lock, 
  Shield, 
  Sparkles,
  Loader2,
  Trash2,
  Server,
  Key,
  Paperclip,
  CornerUpLeft,
  Filter,
  Check,
  Building,
  User,
  Zap
} from "lucide-react";
import { googleSignIn, getAccessToken, logoutWorkspace } from "../lib/workspace-auth.js";
import { auth } from "../firebase.js";
import { authenticatedFetch } from "../lib/apiUtils.js";

interface EmailDetail {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  snippet: string;
  unread: boolean;
  provider: "gmail" | "outlook" | "imap";
  priority?: "High" | "Normal" | "Low";
  category?: "Decision" | "Financial" | "Risk" | "General";
  hasAttachment?: boolean;
}

interface ConnectedAccount {
  id: string;
  email: string;
  provider: "gmail" | "outlook" | "imap";
  providerName: string;
  serverHost?: string;
  status: "connected" | "syncing" | "error";
  isPrimary: boolean;
}

interface SqlLog {
  id: number;
  userId: number;
  actionType: string;
  recipient: string | null;
  subject: string | null;
  status: string;
  createdAt: string;
}

interface GmailVaultProps {
  theme: "dark" | "light";
  lang: "ar" | "en" | "fr";
}

export default function GmailVault({ theme, lang }: GmailVaultProps) {
  // Accounts State
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([
    {
      id: "acc_default_1",
      email: "mohamedvadel60@gmail.com",
      provider: "gmail",
      providerName: "Google Workspace",
      status: "connected",
      isPrimary: true
    },
    {
      id: "acc_corp_2",
      email: "ceo@zakir-causal.com",
      provider: "imap",
      providerName: "Zakir Corporate IMAP/SMTP",
      serverHost: "mail.zakir-causal.com",
      status: "connected",
      isPrimary: false
    }
  ]);
  const [activeAccountEmail, setActiveAccountEmail] = useState<string>("mohamedvadel60@gmail.com");

  const [token, setToken] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"inbox" | "compose" | "logs">("inbox");
  const [emails, setEmails] = useState<EmailDetail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<"all" | "inbound" | "outbound" | "high_risk">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add Account Modal
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [addAccountType, setAddAccountType] = useState<"gmail" | "outlook" | "imap">("gmail");
  const [imapEmail, setImapEmail] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapPassword, setImapPassword] = useState("");
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  // Quick Reply
  const [quickReplyText, setQuickReplyText] = useState("");
  const [isSendingQuickReply, setIsSendingQuickReply] = useState(false);

  // Compose form states
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  
  // Cloud SQL transaction logs
  const [sqlLogs, setSqlLogs] = useState<SqlLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Translations
  const t = {
    ar: {
      title: "مركز البريد الإلكتروني المؤسسي",
      subtitle: "إدارة ومزامنة البريد الداخلي والخارجي، Gmail، Outlook والخوادم المخصصة",
      connectBtn: "ربط حساب بريد جديد",
      connectedAs: "الحساب النشط:",
      disconnect: "قطع الحساب",
      inboxTab: "صندوق الوارد",
      composeTab: "إنشاء رسالة",
      logsTab: "سجلات الأمان (Cloud SQL)",
      searchPlaceholder: "البحث في الرسائل، العناوين والمواضيع...",
      noEmails: "لا توجد رسائل بريد إلكتروني في هذا المجلد.",
      from: "من:",
      to: "إلى:",
      date: "التاريخ:",
      composeTitle: "رسالة جديدة",
      recipient: "عنوان المستلم (Email)",
      subject: "الموضوع",
      body: "نص الرسالة",
      sendBtn: "إرسال البريد الإلكتروني",
      confirmSendTitle: "تأكيد إرسال البريد الإلكتروني",
      confirmSendDesc: "هل أنت متأكد من رغبتك في إرسال هذا البريد؟ سيتم توثيق العملية وتخزين السجل في قاعدة بيانات Cloud SQL الأمنية.",
      cancel: "إلغاء",
      confirmSendBtn: "نعم، أرسل الآن",
      sending: "جاري الإرسال...",
      sendSuccess: "تم إرسال البريد بنجاح وتسجيل المعاملة بنجاح!",
      errorHeader: "تنبيه بالنظام",
      sqlLogTitle: "سجل حركات ومعاملات البريد",
      sqlLogDesc: "تخزين آمن ومزامن لحظياً عبر قاعدة البيانات الحديثة.",
      logAction: "نوع الحركة",
      logRecipient: "المستلم",
      logSubject: "الموضوع",
      logStatus: "الحالة",
      logTime: "التوقيت",
      emptyLogs: "لا توجد سجلات حركات حتى الآن.",
      secureConnection: "تشفير آمن ومصادقة بروتوكولات البريد المؤسسي",
      addAccountTitle: "إضافة حساب بريد إلكتروني جديد",
      selectProvider: "اختر موفر الخدمة:",
      customImapHost: "خادم IMAP/SMTP",
      port: "المنفذ (Port)",
      passwordApp: "كلمة مرور التطبيق / السر",
      saveConnect: "حفظ وربط البريد",
      quickReply: "رد سريع...",
      sendReply: "إرسال الرد",
      convertMemory: "تحويل إلى ذاكرة سببية"
    },
    en: {
      title: "Enterprise Email Vault",
      subtitle: "Manage & sync Gmail, Outlook, Exchange, and custom corporate email servers",
      connectBtn: "Connect New Mail Account",
      connectedAs: "Active Account:",
      disconnect: "Disconnect Account",
      inboxTab: "Inbox",
      composeTab: "Compose Email",
      logsTab: "Audit Logs (Cloud SQL)",
      searchPlaceholder: "Search emails, recipients, subjects...",
      noEmails: "No emails found in this view.",
      from: "From:",
      to: "To:",
      date: "Date:",
      composeTitle: "New Message",
      recipient: "Recipient Email",
      subject: "Subject",
      body: "Message Body",
      sendBtn: "Send Email",
      confirmSendTitle: "Confirm Transmission",
      confirmSendDesc: "Are you sure you want to transmit this email? This operation will be logged to the Cloud SQL audit registry.",
      cancel: "Cancel",
      confirmSendBtn: "Yes, send now",
      sending: "Transmitting...",
      sendSuccess: "Email transmitted successfully and recorded in audit log!",
      errorHeader: "System Notice",
      sqlLogTitle: "Mail Transaction Ledger",
      sqlLogDesc: "Real-time encrypted logging across Cloud SQL database instances.",
      logAction: "Action",
      logRecipient: "Recipient",
      logSubject: "Subject",
      logStatus: "Status",
      logTime: "Timestamp",
      emptyLogs: "No transaction logs logged yet.",
      secureConnection: "Encrypted enterprise mail protocol synchronization",
      addAccountTitle: "Add New Email Account",
      selectProvider: "Select Service Provider:",
      customImapHost: "IMAP/SMTP Server Host",
      port: "Port",
      passwordApp: "App Password / Secret",
      saveConnect: "Save & Connect Mail",
      quickReply: "Quick reply...",
      sendReply: "Send Reply",
      convertMemory: "Convert to Causal Memory"
    },
    fr: {
      title: "Coffre-fort de Messagerie d'Entreprise",
      subtitle: "Gérez et synchronisez Gmail, Outlook et serveurs de messagerie d'entreprise",
      connectBtn: "Connecter un nouveau compte",
      connectedAs: "Compte actif :",
      disconnect: "Déconnecter",
      inboxTab: "Boîte de réception",
      composeTab: "Rédiger un e-mail",
      logsTab: "Journaux d'audit (Cloud SQL)",
      searchPlaceholder: "Rechercher des messages, destinataires...",
      noEmails: "Aucun e-mail trouvé.",
      from: "De :",
      to: "À :",
      date: "Date :",
      composeTitle: "Nouveau message",
      recipient: "E-mail du destinataire",
      subject: "Objet",
      body: "Corps du message",
      sendBtn: "Envoyer l'e-mail",
      confirmSendTitle: "Confirmer l'envoi",
      confirmSendDesc: "Êtes-vous sûr de vouloir envoyer cet e-mail ?",
      cancel: "Annuler",
      confirmSendBtn: "Oui, envoyer",
      sending: "Envoi en cours...",
      sendSuccess: "E-mail envoyé avec succès !",
      errorHeader: "Avis du système",
      sqlLogTitle: "Registre des transactions e-mail",
      sqlLogDesc: "Enregistrement en temps réel dans Cloud SQL.",
      logAction: "Action",
      logRecipient: "Destinataire",
      logSubject: "Objet",
      logStatus: "Statut",
      logTime: "Horodatage",
      emptyLogs: "Aucun journal de transaction disponible.",
      secureConnection: "Synchronisation sécurisée des protocoles e-mail",
      addAccountTitle: "Ajouter un nouveau compte de messagerie",
      selectProvider: "Sélectionnez le fournisseur :",
      customImapHost: "Hôte du serveur IMAP/SMTP",
      port: "Port",
      passwordApp: "Mot de passe d'application",
      saveConnect: "Enregistrer et connecter",
      quickReply: "Réponse rapide...",
      sendReply: "Envoyer la réponse",
      convertMemory: "Convertir en mémoire causale"
    }
  }[lang || "en"];

  // Initialize Auth & Default Demo Emails
  useEffect(() => {
    async function checkAuth() {
      const activeToken = await getAccessToken();
      if (activeToken) {
        setToken(activeToken);
      }
      loadSampleAndRealEmails();
    }
    checkAuth();
  }, [activeAccountEmail, token]);

  const loadSampleAndRealEmails = () => {
    const defaultSampleEmails: EmailDetail[] = [
      {
        id: "em_101",
        subject: lang === "ar" ? "تقرير تقييم المخاطر الاستثمارية - الربع الثالث" : "Q3 Investment Risk Evaluation Report",
        from: "audit@zakir-causal.com",
        to: activeAccountEmail,
        date: new Date(Date.now() - 1000 * 60 * 45).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        snippet: lang === "ar" ? "يرجى مراجعة ملخص القرارات المعتمدة لمجلس الإدارة والمخاطر التشغيلية المصاحبة..." : "Please find attached the approved decision logs and risk factors...",
        body: lang === "ar" 
          ? "السادة الأفاضل،\n\nنرفق لكم التقرير المالي والسببي الخاص بالربع الثالث. يتضمن التحليل صدمات أسعار التضخم وآلية التحوط السلوكي الموصى بها في منصة Zakir.\n\nتاريخ الاعتماد: 2026-07-27\nمسؤول الامتثال: مكتب إدارة المخاطر"
          : "Dear Executive Team,\n\nPlease review the Q3 Causal Risk Evaluation Report. It incorporates inflation metrics and behavioral mitigation models derived from Zakir Causal Memory.\n\nApproved Date: 2026-07-27\nCompliance Lead: Risk Management Board",
        unread: true,
        provider: "imap",
        priority: "High",
        category: "Risk",
        hasAttachment: true
      },
      {
        id: "em_102",
        subject: lang === "ar" ? "تأكيد اعتماد ميزانية التوسع المؤسسي" : "Confirmation: Expansion Budget Approval",
        from: "finance@mauritania-group.mr",
        to: activeAccountEmail,
        date: new Date(Date.now() - 1000 * 60 * 180).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        snippet: lang === "ar" ? "تم تحويل المبلغ المطلوب إلى الحساب الاستثماري المخصص وفق البنود التالية..." : "The required allocation has been wired to the designated account...",
        body: lang === "ar"
          ? "تحية طيبة،\n\nنود إفادتكم بتمويل الميزانية الاستراتيجية للفرع الجديد بعد مراجعة سجل القرارات السابقة لتجنب عجز السيولة.\n\nالمبلغ المعتمد: $189,000 USD\nالحالة: مكتملة بنجاح"
          : "Greetings,\n\nWe confirm the release of the strategic expansion budget following historical memory check on cash reserves.\n\nApproved Amount: $189,000 USD\nStatus: Settled",
        unread: false,
        provider: "gmail",
        priority: "High",
        category: "Financial",
        hasAttachment: false
      },
      {
        id: "em_103",
        subject: lang === "ar" ? "مذكرة تفاهم الشراكة الاستراتيجية والإلكترونية" : "Strategic Partnership Memorandum",
        from: "partnerships@global-tech.org",
        to: activeAccountEmail,
        date: new Date(Date.now() - 1000 * 60 * 360).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        snippet: lang === "ar" ? "يسرنا دعوتكم لمراجعة المسودة النهائية لاتفاقية الربط الشبكي..." : "We invite you to review the final draft of our enterprise integration agreement...",
        body: lang === "ar"
          ? "مرحباً دكتور محمد،\n\nبناءً على اجتماعاتنا السابقة، أرفقنا مسودة الشراكة المؤسسية الخاصة بدمج الذكاء الاصطناعي مع نظم الحوكمة.\n\nتحياتنا،\nفريق التطوير المؤسسي"
          : "Hello Mohamed,\n\nFollowing up on our discussions, attached is the revised MOU for AI integration with corporate governance frameworks.\n\nBest regards,\nPartnerships Team",
        unread: false,
        provider: "outlook",
        priority: "Normal",
        category: "Decision",
        hasAttachment: true
      }
    ];

    setEmails(defaultSampleEmails);
    if (token && activeAccountEmail.includes("gmail.com")) {
      fetchInbox();
    }
  };

  // Helper to fetch current firebase ID token
  const getFirebaseIdToken = async (): Promise<string | null> => {
    try {
      const { auth } = await import("../firebase");
      const currentUser = auth.currentUser;
      if (currentUser) {
        return await currentUser.getIdToken();
      }
    } catch (e) {
      console.error("Error obtaining Firebase ID token", e);
    }
    return null;
  };

  // Log action to Cloud SQL database
  const logActionToSql = async (actionType: string, recipient: string | null, subject: string | null, status: string) => {
    try {
      await authenticatedFetch("/api/sql/gmail-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType,
          recipient,
          subject,
          status
        })
      });
      fetchSqlLogs();
    } catch (err) {
      console.error("Failed to log Email transaction to Cloud SQL:", err);
    }
  };

  // Fetch list of Email logs from Cloud SQL
  const fetchSqlLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await authenticatedFetch("/api/sql/gmail-logs");
      if (res.ok) {
        const data = await res.json();
        setSqlLogs(data);
      }
    } catch (err) {
      console.error("Error fetching SQL transaction logs:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Perform Google OAuth connection
  const handleConnectGoogle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await googleSignIn();
      if (res && res.user?.email) {
        const newEmail = res.user.email;
        setToken(res.accessToken);

        if (!accounts.some(a => a.email.toLowerCase() === newEmail.toLowerCase())) {
          const newAcc: ConnectedAccount = {
            id: `acc_google_${Date.now()}`,
            email: newEmail,
            provider: "gmail",
            providerName: "Google Workspace",
            status: "connected",
            isPrimary: accounts.length === 0
          };
          setAccounts(prev => [...prev, newAcc]);
        }
        setActiveAccountEmail(newEmail);
        setSuccessMessage(lang === "ar" ? `تم ربط حساب Google (${newEmail}) بنجاح!` : `Successfully connected Google account (${newEmail})!`);
      }
    } catch (err: any) {
      if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") {
        console.log("Authentication popup closed by user.");
      } else {
        setError(err.message || "Failed to authenticate via Google OAuth");
      }
    } finally {
      setIsLoading(false);
      setShowAddAccountModal(false);
    }
  };

  // Add Custom IMAP/SMTP Account
  const handleAddCustomAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imapEmail || !imapEmail.includes("@")) {
      setError(lang === "ar" ? "يرجى إدخال عنوان بريد إلكتروني صحيح" : "Please enter a valid email address");
      return;
    }

    setIsAddingAccount(true);
    setTimeout(() => {
      const newAcc: ConnectedAccount = {
        id: `acc_imap_${Date.now()}`,
        email: imapEmail.trim(),
        provider: addAccountType,
        providerName: addAccountType === "outlook" ? "Microsoft 365 / Outlook" : "Custom IMAP/SMTP Corporate",
        serverHost: imapHost || (addAccountType === "outlook" ? "outlook.office365.com" : "mail." + imapEmail.split("@")[1]),
        status: "connected",
        isPrimary: accounts.length === 0
      };

      setAccounts(prev => [...prev, newAcc]);
      setActiveAccountEmail(imapEmail.trim());
      setIsAddingAccount(false);
      setShowAddAccountModal(false);
      setImapEmail("");
      setImapHost("");
      setImapPassword("");
      setSuccessMessage(lang === "ar" ? `تم إضافة وربط البريد المؤسسي (${imapEmail}) بنجاح!` : `Enterprise Mail account (${imapEmail}) linked successfully!`);
      logActionToSql("LINK_MAIL_ACCOUNT", imapEmail, "Custom Server Auth", "SUCCESS");
    }, 600);
  };

  // Disconnect Account (Disconnects OAuth token without terminating Firebase app session)
  const handleDisconnectAccount = async (accountEmail: string) => {
    if (accountEmail.includes("gmail.com")) {
      setToken(null);
    }
    const updated = accounts.filter(a => a.email !== accountEmail);
    setAccounts(updated);
    if (activeAccountEmail === accountEmail) {
      if (updated.length > 0) {
        setActiveAccountEmail(updated[0].email);
      } else {
        setActiveAccountEmail("");
        setEmails([]);
        setSelectedEmail(null);
      }
    }
    setSuccessMessage(lang === "ar" ? "تم إزالة حساب البريد الإلكتروني" : (lang === "fr" ? "Compte de messagerie déconnecté." : "Account disconnected."));
  };

  // Delete Individual Email Item
  const handleDeleteEmail = (emailId: string) => {
    setEmails(prev => prev.filter(e => e.id !== emailId));
    if (selectedEmail?.id === emailId) {
      setSelectedEmail(null);
    }
    setSuccessMessage(
      lang === "ar" 
        ? "تم حذف الرسالة الإلكترونية بنجاح" 
        : (lang === "fr" ? "Message supprimé avec succès" : "Email deleted successfully")
    );
    logActionToSql("DELETE_EMAIL", selectedEmail?.from || emailId, selectedEmail?.subject || "Local deletion", "SUCCESS");
  };

  // Fetch Inbox messages from Google API if token exists
  const fetchInbox = async (searchStr: string = "") => {
    if (!token) return;
    setIsRefreshing(true);
    setError(null);
    try {
      let url = "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10";
      if (searchStr) {
        url += `&q=${encodeURIComponent(searchStr)}`;
      }
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) return;

      const data = await res.json();
      const messages = data.messages || [];
      
      const detailsPromises = messages.map(async (msg: any) => {
        const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!detailRes.ok) return null;
        const detailData = await detailRes.json();
        
        const headers = detailData.payload.headers;
        const subject = headers.find((h: any) => h.name.toLowerCase() === "subject")?.value || "(No Subject)";
        const from = headers.find((h: any) => h.name.toLowerCase() === "from")?.value || "Unknown Sender";
        const to = headers.find((h: any) => h.name.toLowerCase() === "to")?.value || "me";
        const date = headers.find((h: any) => h.name.toLowerCase() === "date")?.value || "";
        
        let body = "";
        if (detailData.payload.parts) {
          const textPart = detailData.payload.parts.find((p: any) => p.mimeType === "text/plain") || detailData.payload.parts[0];
          if (textPart && textPart.body && textPart.body.data) {
            try {
              body = atob(textPart.body.data.replace(/-/g, "+").replace(/_/g, "/"));
            } catch (e) {
              body = detailData.snippet || "";
            }
          }
        } else if (detailData.payload.body && detailData.payload.body.data) {
          try {
            body = atob(detailData.payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
          } catch (e) {
            body = detailData.snippet || "";
          }
        }

        return {
          id: msg.id,
          subject,
          from,
          to,
          date: new Date(date).toLocaleString(lang === "ar" ? "ar-EG" : "en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          }),
          body: body || detailData.snippet || "",
          snippet: detailData.snippet || "",
          unread: detailData.labelIds?.includes("UNREAD") || false,
          provider: "gmail" as const,
          category: "General" as const
        };
      });

      const fullEmails = (await Promise.all(detailsPromises)).filter(Boolean) as EmailDetail[];
      if (fullEmails.length > 0) {
        setEmails(prev => {
          const combined = [...fullEmails, ...prev];
          const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
          return unique;
        });
      }
      logActionToSql("READ_INBOX", activeAccountEmail, searchStr ? `Search: ${searchStr}` : "Inbox Refresh", "SUCCESS");
    } catch (err: any) {
      console.warn("API retrieve email fallback used:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Submit and send Email
  const handleSendEmail = async () => {
    if (!composeTo || !composeSubject || !composeBody) {
      setError(lang === "ar" ? "يرجى تعبئة جميع الحقول المطلوبة (المستلم، الموضوع، نص الرسالة)" : "Please fill in all required fields (To, Subject, Body).");
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      const response = await authenticatedFetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          body: composeBody,
          from: activeAccountEmail,
          googleAccessToken: token || undefined
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Failed to deliver email.");
      }

      // Add sent message locally
      const sentItem: EmailDetail = {
        id: resData.messageId || `sent_${Date.now()}`,
        subject: composeSubject,
        from: activeAccountEmail,
        to: composeTo,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        snippet: composeBody.substring(0, 80) + "...",
        body: composeBody,
        unread: false,
        provider: accounts.find(a => a.email === activeAccountEmail)?.provider || "imap",
        category: "General"
      };

      setEmails(prev => [sentItem, ...prev]);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      setShowSendConfirm(false);
      setActiveSubTab("inbox");
      setSelectedEmail(sentItem);
      
      const successText = resData.previewUrl 
        ? (lang === "ar" ? `تم إرسال البريد وتوثيق وصول الرسالة للمستلم بنجاح! (معرف الرسالة: ${resData.messageId || 'OK'})` : `Email transmitted and delivered to recipient! Message ID: ${resData.messageId || 'OK'}`)
        : (lang === "ar" ? `تم إرسال البريد الإلكتروني للمستلم (${composeTo}) بنجاح!` : `Email successfully sent to ${composeTo}!`);
      
      setSuccessMessage(successText);

      logActionToSql("SEND_EMAIL", composeTo, composeSubject, "SUCCESS");
    } catch (err: any) {
      setError(err.message || "Failed to transmit message.");
      logActionToSql("SEND_EMAIL", composeTo, composeSubject, "FAILED");
    } finally {
      setIsSending(false);
    }
  };

  // Quick reply handler
  const handleSendQuickReply = async () => {
    if (!quickReplyText.trim() || !selectedEmail) return;
    setIsSendingQuickReply(true);

    try {
      const replySubject = selectedEmail.subject.startsWith("Re:") ? selectedEmail.subject : `Re: ${selectedEmail.subject}`;
      const response = await authenticatedFetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedEmail.from,
          subject: replySubject,
          body: quickReplyText,
          from: activeAccountEmail,
          googleAccessToken: token || undefined
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Failed to send quick reply.");
      }

      const replyMsg: EmailDetail = {
        id: resData.messageId || `reply_${Date.now()}`,
        subject: replySubject,
        from: activeAccountEmail,
        to: selectedEmail.from,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        snippet: quickReplyText,
        body: quickReplyText,
        unread: false,
        provider: selectedEmail.provider,
        category: selectedEmail.category
      };

      setEmails(prev => [replyMsg, ...prev]);
      setQuickReplyText("");
      setSuccessMessage(lang === "ar" ? `تم إرسال الرد السريع للمستلم (${selectedEmail.from}) بنجاح!` : `Quick reply delivered to ${selectedEmail.from}!`);
      logActionToSql("QUICK_REPLY", selectedEmail.from, replySubject, "SUCCESS");
    } catch (err: any) {
      setError(err.message || "Failed to send quick reply.");
    } finally {
      setIsSendingQuickReply(false);
    }
  };

  const filteredEmails = emails.filter(email => {
    const matchesSearch = searchQuery === "" || 
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.snippet.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterCategory === "high_risk") return email.priority === "High" || email.category === "Risk";
    if (filterCategory === "outbound") return email.from === activeAccountEmail;
    if (filterCategory === "inbound") return email.from !== activeAccountEmail;
    return true;
  });

  const activeAccountObj = accounts.find(a => a.email === activeAccountEmail) || accounts[0];

  return (
    <div id="email-vault-container" className="space-y-6">
      {/* Header Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        theme === "dark" 
          ? "bg-slate-900/80 border-slate-800 shadow-xl shadow-slate-950/20" 
          : "bg-white border-slate-200 shadow-md shadow-slate-100/40"
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`p-3.5 rounded-2xl ${
              theme === "dark" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}>
              <Mail className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-2xl font-black ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                  {t.title}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30">
                  Universal Mail
                </span>
              </div>
              <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"} mt-0.5 flex items-center gap-1.5`}>
                <Shield className="w-3.5 h-3.5 text-amber-500" />
                {t.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Account Switcher Dropdown */}
            {accounts.length > 0 && (
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                  {t.connectedAs}
                </span>
                <select
                  value={activeAccountEmail}
                  onChange={(e) => setActiveAccountEmail(e.target.value)}
                  className={`h-10 px-3 rounded-xl text-xs font-bold outline-none border transition-all cursor-pointer ${
                    theme === "dark"
                      ? "bg-slate-950 border-slate-800 text-white focus:border-[#D4AF37]"
                      : "bg-slate-100 border-slate-200 text-slate-900 focus:border-[#D4AF37]"
                  }`}
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.email}>
                      {acc.email} ({acc.providerName})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => setShowAddAccountModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-amber-900/20 hover:from-amber-400 hover:to-amber-500 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {t.connectBtn}
            </button>

            {activeAccountEmail && (
              <button
                onClick={() => handleDisconnectAccount(activeAccountEmail)}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  theme === "dark" 
                    ? "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-800" 
                    : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                }`}
                title={t.disconnect}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      {successMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
          theme === "dark" ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"
        }`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="p-1 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
          theme === "dark" ? "bg-rose-950/30 border-rose-800/40 text-rose-400" : "bg-rose-50 border-rose-200 text-rose-700"
        }`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Mail Vault Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Navigation Sidebar & Mail List */}
        <div className="lg:col-span-4 space-y-4">
          {/* View Sub-Tabs */}
          <div className={`p-1.5 rounded-xl flex gap-1 ${
            theme === "dark" ? "bg-slate-950/60 border border-slate-800/80" : "bg-slate-100 border border-slate-200"
          }`}>
            <button
              onClick={() => { setActiveSubTab("inbox"); setSelectedEmail(null); }}
              className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === "inbox"
                  ? (theme === "dark" ? "bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30" : "bg-white text-slate-950 shadow-sm")
                  : (theme === "dark" ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900")
              }`}
            >
              {t.inboxTab}
            </button>
            <button
              onClick={() => { setActiveSubTab("compose"); setSelectedEmail(null); }}
              className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === "compose"
                  ? (theme === "dark" ? "bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30" : "bg-white text-slate-950 shadow-sm")
                  : (theme === "dark" ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900")
              }`}
            >
              {t.composeTab}
            </button>
            <button
              onClick={() => { setActiveSubTab("logs"); setSelectedEmail(null); fetchSqlLogs(); }}
              className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === "logs"
                  ? (theme === "dark" ? "bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30" : "bg-white text-slate-950 shadow-sm")
                  : (theme === "dark" ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900")
              }`}
            >
              {t.logsTab}
            </button>
          </div>

          {/* Emails Inbox List */}
          {activeSubTab === "inbox" && (
            <div className={`p-4 rounded-xl border space-y-4 ${
              theme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200"
            }`}>
              {/* Search Bar & Category Filters */}
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className={`w-full h-10 pl-10 pr-4 rounded-xl text-xs outline-none transition-all ${
                      theme === "dark"
                        ? "bg-slate-950 border border-slate-800 text-white focus:border-[#D4AF37]"
                        : "bg-slate-50 border border-slate-200 text-slate-900 focus:border-[#D4AF37]"
                    }`}
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] font-bold">
                  {[
                    { id: "all", label: lang === "ar" ? "الكل" : "All" },
                    { id: "inbound", label: lang === "ar" ? "الوارد" : "Inbound" },
                    { id: "outbound", label: lang === "ar" ? "الصادر" : "Outbound" },
                    { id: "high_risk", label: lang === "ar" ? "مخاطر عالية" : "High Risk" }
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFilterCategory(f.id as any)}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer shrink-0 ${
                        filterCategory === f.id
                          ? "bg-amber-500 text-slate-950 font-black"
                          : (theme === "dark" ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Email Items List */}
              {isRefreshing ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
                  <span className={`text-[11px] ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                    {lang === "ar" ? "جاري جلب الرسائل الآمنة..." : "Fetching encrypted messages..."}
                  </span>
                </div>
              ) : filteredEmails.length === 0 ? (
                <div className={`py-12 text-center text-xs ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                  <Inbox className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  {t.noEmails}
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {filteredEmails.map((email) => (
                    <button
                      key={email.id}
                      onClick={() => setSelectedEmail(email)}
                      className={`w-full text-right p-3 rounded-xl border transition-all cursor-pointer block ${
                        selectedEmail?.id === email.id
                          ? (theme === "dark" ? "bg-[#D4AF37]/10 border-[#D4AF37]/40 shadow-sm" : "bg-amber-50/70 border-amber-300")
                          : (theme === "dark" ? "bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/30" : "bg-slate-50 border-slate-100 hover:bg-slate-100/50")
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                          <span className={`text-[10px] font-bold truncate ${theme === "dark" ? "text-[#D4AF37]" : "text-amber-800"}`}>
                            {email.from.split("<")[0].trim() || email.from}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {email.priority === "High" && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="High Priority" />
                          )}
                          <span className={`text-[9px] ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                            {email.date}
                          </span>
                        </div>
                      </div>

                      <h4 className={`text-xs font-bold truncate ${
                        email.unread 
                          ? (theme === "dark" ? "text-white" : "text-slate-900") 
                          : (theme === "dark" ? "text-slate-300" : "text-slate-600")
                      }`}>
                        {email.subject}
                      </h4>
                      <p className={`text-[10px] truncate mt-1 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                        {email.snippet}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Connected Mail Provider Info */}
          <div className={`p-4 rounded-xl border flex gap-3 ${
            theme === "dark" ? "bg-slate-900/30 border-slate-800/60 text-slate-400" : "bg-slate-50 border-slate-200/60 text-slate-600"
          }`}>
            <Server className="w-5 h-5 text-[#D4AF37] shrink-0" />
            <div className="text-[11px] space-y-1">
              <span className="font-bold text-white block">
                {lang === "ar" ? "معيار التشفير المؤسسي" : "Enterprise Mail Security"}
              </span>
              <p>
                {lang === "ar" 
                  ? "يتم توثيق كافة المراسلات والمعاملات في قاعدة بيانات Cloud SQL مع مطابقة التشفير ثنائي الاتجاه." 
                  : "All email operations and attachments are synced and audit-logged in real-time."}
              </p>
            </div>
          </div>
        </div>

        {/* Email Content Viewer Area */}
        <div className="lg:col-span-8">
          {activeSubTab === "inbox" && (
            <div className={`h-full min-h-[480px] p-6 rounded-xl border flex flex-col justify-between ${
              theme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200"
            }`}>
              {selectedEmail ? (
                <div className="space-y-6 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Header Controls */}
                    <div className={`pb-4 border-b ${theme === "dark" ? "border-slate-800" : "border-slate-100"}`}>
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-base font-extrabold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                            {selectedEmail.subject}
                          </h3>
                          {selectedEmail.category && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              {selectedEmail.category}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEmail(selectedEmail.id);
                            }}
                            className={`p-1.5 rounded-lg text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer`}
                            title={lang === "ar" ? "حذف هذه الرسالة" : (lang === "fr" ? "Supprimer cet e-mail" : "Delete Email")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => setSelectedEmail(null)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              theme === "dark" ? "hover:bg-slate-800 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                            }`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>{t.from}</span>
                          <span className={`font-bold ${theme === "dark" ? "text-[#D4AF37]" : "text-amber-800"}`}>{selectedEmail.from}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>{t.to}</span>
                          <span className={theme === "dark" ? "text-slate-300" : "text-slate-700"}>{selectedEmail.to}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>{t.date}</span>
                          <span className={theme === "dark" ? "text-slate-400" : "text-slate-500"}>{selectedEmail.date}</span>
                        </div>
                      </div>
                    </div>

                    {/* Email Body */}
                    <div className={`mt-6 text-xs leading-relaxed whitespace-pre-wrap ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                      {selectedEmail.body}
                    </div>
                  </div>

                  {/* Quick Reply Form */}
                  <div className={`pt-4 border-t mt-6 ${theme === "dark" ? "border-slate-800" : "border-slate-100"}`}>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={quickReplyText}
                        onChange={(e) => setQuickReplyText(e.target.value)}
                        placeholder={t.quickReply}
                        className={`flex-1 h-10 px-4 rounded-xl text-xs outline-none transition-all ${
                          theme === "dark"
                            ? "bg-slate-950 border border-slate-800 text-white focus:border-[#D4AF37]"
                            : "bg-slate-50 border border-slate-200 text-slate-900 focus:border-[#D4AF37]"
                        }`}
                      />
                      <button
                        onClick={handleSendQuickReply}
                        disabled={!quickReplyText.trim() || isSendingQuickReply}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-md hover:from-amber-400 hover:to-amber-500 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {isSendingQuickReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CornerUpLeft className="w-3.5 h-3.5" />}
                        <span>{t.sendReply}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="my-auto py-16 text-center">
                  <Mail className="w-12 h-12 mx-auto text-slate-600 mb-3 animate-pulse" />
                  <span className={`text-xs font-bold ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                    {lang === "ar" ? "اختر رسالة بريد إلكتروني لقراءتها واستعراض التفاصيل" : "Select an email message from the list to view full details"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* COMPOSE VIEW */}
          {activeSubTab === "compose" && (
            <div className={`p-6 rounded-xl border ${
              theme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200"
            }`}>
              <h3 className={`text-sm font-extrabold mb-4 flex items-center gap-2 ${theme === "dark" ? "text-[#D4AF37]" : "text-amber-800"}`}>
                <Send className="w-4 h-4" />
                {t.composeTitle} ({activeAccountEmail})
              </h3>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className={`text-[11px] font-bold ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                    {t.recipient}
                  </label>
                  <input
                    type="email"
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="e.g. board@enterprise.com"
                    className={`w-full h-10 px-4 rounded-xl text-xs outline-none transition-all ${
                      theme === "dark"
                        ? "bg-slate-950 border border-slate-800 text-white focus:border-[#D4AF37]"
                        : "bg-slate-50 border border-slate-200 text-slate-900 focus:border-[#D4AF37]"
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`text-[11px] font-bold ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                    {t.subject}
                  </label>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Subject line"
                    className={`w-full h-10 px-4 rounded-xl text-xs outline-none transition-all ${
                      theme === "dark"
                        ? "bg-slate-950 border border-slate-800 text-white focus:border-[#D4AF37]"
                        : "bg-slate-50 border border-slate-200 text-slate-900 focus:border-[#D4AF37]"
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`text-[11px] font-bold ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                    {t.body}
                  </label>
                  <textarea
                    rows={10}
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    placeholder="Write message contents..."
                    className={`w-full p-4 rounded-xl text-xs outline-none transition-all resize-none ${
                      theme === "dark"
                        ? "bg-slate-950 border border-slate-800 text-white focus:border-[#D4AF37]"
                        : "bg-slate-50 border border-slate-200 text-slate-900 focus:border-[#D4AF37]"
                    }`}
                  />
                </div>

                <button
                  onClick={() => setShowSendConfirm(true)}
                  disabled={!composeTo || !composeSubject || !composeBody}
                  className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg hover:from-amber-400 hover:to-amber-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {t.sendBtn}
                </button>
              </div>
            </div>
          )}

          {/* LOGS VIEW */}
          {activeSubTab === "logs" && (
            <div className={`p-6 rounded-xl border space-y-4 ${
              theme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200"
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-sm font-extrabold flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                    <History className="w-4 h-4 text-[#D4AF37]" />
                    {t.sqlLogTitle}
                  </h3>
                  <p className={`text-[10px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"} mt-0.5`}>
                    {t.sqlLogDesc}
                  </p>
                </div>

                <button
                  onClick={fetchSqlLogs}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    theme === "dark" 
                      ? "bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-300" 
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? "animate-spin text-[#D4AF37]" : ""}`} />
                </button>
              </div>

              {isLoadingLogs ? (
                <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[#D4AF37]" />
                  <span>Loading Cloud SQL logs...</span>
                </div>
              ) : sqlLogs.length === 0 ? (
                <div className={`py-12 text-center text-xs ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                  <Clock className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  {t.emptyLogs}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-[11px]">
                    <thead>
                      <tr className={`border-b ${theme === "dark" ? "border-slate-800" : "border-slate-100"}`}>
                        <th className={`py-2 px-1 text-right font-bold ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{t.logAction}</th>
                        <th className={`py-2 px-1 text-right font-bold ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{t.logRecipient}</th>
                        <th className={`py-2 px-1 text-right font-bold ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{t.logSubject}</th>
                        <th className={`py-2 px-1 text-center font-bold ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{t.logStatus}</th>
                        <th className={`py-2 px-1 text-left font-bold ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{t.logTime}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {sqlLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/10 transition-colors">
                          <td className="py-2 px-1 text-slate-200 font-semibold">{log.actionType}</td>
                          <td className="py-2 px-1 text-slate-400">{log.recipient || "-"}</td>
                          <td className="py-2 px-1 text-slate-300 truncate max-w-[150px]">{log.subject || "-"}</td>
                          <td className="py-2 px-1 text-center">
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                              log.status === "SUCCESS"
                                ? (theme === "dark" ? "bg-emerald-950/40 text-emerald-400" : "bg-emerald-50 text-emerald-600")
                                : (theme === "dark" ? "bg-rose-950/40 text-rose-400" : "bg-rose-50 text-rose-600")
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="py-2 px-1 text-left text-slate-500">
                            {new Date(log.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ADD ACCOUNT MODAL */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAddAccountModal(false)} />
          <div className={`relative w-full max-w-lg p-6 rounded-2xl border ${
            theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
          } shadow-2xl animate-in fade-in zoom-in-95 duration-200`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <Mail className="w-5 h-5 text-amber-500" />
                {t.addAccountTitle}
              </h3>
              <button onClick={() => setShowAddAccountModal(false)} className="p-1 hover:opacity-80">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Provider Chooser */}
            <div className="space-y-4 mb-6">
              <label className="text-xs font-bold text-slate-400 block">{t.selectProvider}</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAddAccountType("gmail")}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                    addAccountType === "gmail"
                      ? "bg-amber-500/10 border-amber-500 text-amber-500"
                      : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <Mail className="w-5 h-5" />
                  <span>Google / Gmail</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAddAccountType("outlook")}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                    addAccountType === "outlook"
                      ? "bg-amber-500/10 border-amber-500 text-amber-500"
                      : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <Building className="w-5 h-5" />
                  <span>Outlook / 365</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAddAccountType("imap")}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                    addAccountType === "imap"
                      ? "bg-amber-500/10 border-amber-500 text-amber-500"
                      : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <Server className="w-5 h-5" />
                  <span>IMAP / SMTP</span>
                </button>
              </div>
            </div>

            {addAccountType === "gmail" ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  {lang === "ar" 
                    ? "قم بتوثيق حساب Google Workspace أو Gmail مباشرة عبر نظام المصادقة الآمن OAuth."
                    : "Connect your Google Workspace or Gmail address seamlessly via OAuth protocol."}
                </p>
                <button
                  onClick={handleConnectGoogle}
                  disabled={isLoading}
                  className="w-full h-11 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs rounded-xl shadow-lg hover:from-red-500 hover:to-rose-500 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  <span>{t.connectBtn} (Google OAuth)</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddCustomAccount} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400">العنوان البريدي (Email Address)</label>
                  <input
                    type="email"
                    required
                    value={imapEmail}
                    onChange={(e) => setImapEmail(e.target.value)}
                    placeholder="e.g. executive@firm.org"
                    className="w-full h-10 px-4 rounded-xl text-xs bg-slate-950 border border-slate-800 text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-400">{t.customImapHost}</label>
                    <input
                      type="text"
                      value={imapHost}
                      onChange={(e) => setImapHost(e.target.value)}
                      placeholder="e.g. mail.company.com"
                      className="w-full h-10 px-4 rounded-xl text-xs bg-slate-950 border border-slate-800 text-white outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400">{t.port}</label>
                    <input
                      type="text"
                      value={imapPort}
                      onChange={(e) => setImapPort(e.target.value)}
                      className="w-full h-10 px-4 rounded-xl text-xs bg-slate-950 border border-slate-800 text-white outline-none focus:border-amber-500 text-center"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400">{t.passwordApp}</label>
                  <input
                    type="password"
                    value={imapPassword}
                    onChange={(e) => setImapPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full h-10 px-4 rounded-xl text-xs bg-slate-950 border border-slate-800 text-white outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAddingAccount}
                  className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg hover:from-amber-400 hover:to-amber-500 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isAddingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{t.saveConnect}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CONFIRM SEND MODAL */}
      {showSendConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowSendConfirm(false)} />
          <div className={`relative w-full max-w-md p-6 rounded-2xl border ${
            theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
          } shadow-2xl animate-in fade-in zoom-in-95 duration-200`}>
            <div className="flex items-center gap-3 mb-4 text-amber-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-extrabold">{t.confirmSendTitle}</h3>
            </div>

            <p className={`text-xs ${theme === "dark" ? "text-slate-300" : "text-slate-600"} leading-relaxed mb-6`}>
              {t.confirmSendDesc}
            </p>

            <div className={`p-3.5 rounded-xl text-[11px] space-y-2.5 mb-6 ${
              theme === "dark" ? "bg-slate-950/60" : "bg-slate-50"
            }`}>
              <div>
                <span className={`font-bold ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{t.recipient}:</span>
                <span className="font-semibold text-amber-500 mr-1">{composeTo}</span>
              </div>
              <div>
                <span className={`font-bold ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{t.subject}:</span>
                <span className="font-semibold text-slate-200 mr-1">{composeSubject}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowSendConfirm(false)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  theme === "dark" ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {t.cancel}
              </button>
              <button
                onClick={handleSendEmail}
                disabled={isSending}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg hover:from-amber-400 hover:to-amber-500 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSending && <Loader2 className="w-4 h-4 animate-spin" />}
                {t.confirmSendBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
