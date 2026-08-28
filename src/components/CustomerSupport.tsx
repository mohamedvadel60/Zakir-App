import React, { useState, useEffect, useRef } from "react";
import { safeFormatDate, safeFormatDateTime, safeFormatTime } from "../lib/dateUtils";
import { 
  HelpCircle, 
  MessageSquare, 
  PlusCircle, 
  Send, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Search, 
  Filter, 
  ChevronRight, 
  LifeBuoy, 
  Mail, 
  Phone, 
  Building, 
  FileText, 
  Tag, 
  ShieldCheck, 
  RefreshCw,
  User as UserIcon,
  Bot,
  ArrowRight,
  Paperclip,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  AlertCircle,
  X,
  ChevronDown,
  Lock,
  Key,
  ExternalLink
} from "lucide-react";
import { User, SupportTicket, SupportCategory, SupportPriority, SupportStatus, SupportMessage } from "../types.js";
import { createSupportTicketApi, fetchSupportTicketsApi, addSupportTicketMessageApi, subscribeToSupportTickets } from "../lib/firebaseServices.js";

interface CustomerSupportProps {
  currentUser: User | null;
  lang: string;
  theme?: string;
}

const CATEGORY_OPTIONS: { id: SupportCategory; en: string; ar: string; fr: string; icon: any }[] = [
  { id: "Technical Problem", en: "Technical Issue", ar: "مشكلة فنية في المنصة", fr: "Problème technique", icon: LifeBuoy },
  { id: "Account Problem", en: "Account & Access", ar: "الحساب واستعادة الدخول", fr: "Compte et accès", icon: Lock },
  { id: "Verification Issue", en: "Email & OTP Verification", ar: "توثيق البريد الإلكتروني ورمز OTP", fr: "Vérification e-mail / OTP", icon: ShieldCheck },
  { id: "Billing Issue", en: "Billing & Subscriptions", ar: "الفواتير والاشتراكات", fr: "Facturation et abonnements", icon: FileText },
  { id: "Feature Request", en: "Feature Request", ar: "طلب ميزة جديدة", fr: "Demande de fonctionnalité", icon: Sparkles },
  { id: "Suggestion", en: "Bug Report & Feedback", ar: "الإبلاغ عن خلل أو ثغرة", fr: "Rapport de bug", icon: AlertTriangle },
  { id: "Other", en: "General Inquiry", ar: "استفسار آخر", fr: "Autre demande", icon: HelpCircle },
];

const FAQS = [
  {
    id: "faq_1",
    cat: "Verification",
    qEn: "How do I verify my account and activate full access?",
    qAr: "كيف أقوم بتوثيق حسابي في منصة ذاكر وتفعيله بالكامل؟",
    qFr: "Comment vérifier mon compte Zakir ?",
    aEn: "Upon registering, a 6-digit dynamic verification code is sent to your email or phone number. Enter the code in the verification screen to activate your account instantly. You can also upload enterprise commercial documents under Settings > Account Verification.",
    aAr: "عند إنشاء الحساب، يتم إرسال رمز توثيق ديناميكي مكون من 6 أرقام إلى بريدك الإلكتروني أو هاتفك. أدخل الرمز في شاشة التوثيق لتفعيل الحساب فوراً. كما يمكنك رفع السجل التجاري والوثائق المؤسسية في الإعدادات > توثيق الحساب.",
    aFr: "Lors de votre inscription, un code à 6 chiffres est envoyé par e-mail ou téléphone. Saisissez-le pour activer votre compte. Vous pouvez aussi charger vos documents d'entreprise dans Paramètres > Vérification."
  },
  {
    id: "faq_2",
    cat: "Access",
    qEn: "What should I do if I don't receive the verification OTP code?",
    qAr: "ماذا أفعل إذا لم يصلني رمز التوثيق (OTP) عبر البريد؟",
    qFr: "Que faire si je ne reçois pas le code OTP ?",
    aEn: "Check your spam/junk folder. If it hasn't arrived within 2 minutes, click 'Resend Code' on the verification screen. Alternatively, click 'Verification Help' above to send a direct manual verification request to our compliance team.",
    aAr: "يرجى التحقق من مجلد الرسائل غير المرغوب فيها (Spam). إذا لم يصل الرمز خلال دقيقتين، انقر على 'إعادة إرسال الرمز'. يمكنك أيضاً استخدام تبويب 'مساعدة التوثيق' أعلاه لإرسال طلب توثيق يدوي عاجل لفريق الامتثال.",
    aFr: "Vérifiez votre dossier spams. Si le code n'arrive pas en 2 minutes, cliquez sur 'Renvoyer le code' ou ouvrez une demande via l'onglet 'Aide à la vérification'."
  },
  {
    id: "faq_3",
    cat: "Account",
    qEn: "How do I reset my password if I forget it?",
    qAr: "كيف يمكنني إعادة تعيين كلمة المرور في حال نسيانها؟",
    qFr: "Comment réinitialiser mon mot de passe ?",
    aEn: "Click 'Forgot Password' on the login screen, enter your registered email, and validate the 6-digit verification code sent to your inbox to create a new password.",
    aAr: "انقر على 'نسيت كلمة المرور' في شاشة الدخول، وأدخل بريدك الإلكتروني المسجل. استخدم رمز التحقق المكون من 6 أرقام لإدخال كلمة مرور جديدة وآمنة.",
    aFr: "Cliquez sur 'Mot de passe oublié' sur la page de connexion, entrez votre e-mail et utilisez le code à 6 chiffres reçu pour définir un nouveau mot de passe."
  },
  {
    id: "faq_4",
    cat: "Support",
    qEn: "What is the expected support response time?",
    qAr: "ما هي السرعة المتوقعة لاستجابة فريق الدعم؟",
    qFr: "Quel est le délai de réponse du support ?",
    aEn: "Our enterprise compliance & technical team responds to High/Urgent tickets within 15–30 minutes, and general requests within 2–4 business hours.",
    aAr: "يجيب فريق الدعم والامتثال المؤسسي على التذاكر ذات الأولوية العالية والعاجلة خلال 15-30 دقيقة، والاستفسارات العامة خلال 2-4 ساعات عمل.",
    aFr: "Notre équipe répond aux tickets urgents en 15 à 30 minutes, et aux demandes générales en 2 à 4 heures."
  },
  {
    id: "faq_5",
    cat: "Security",
    qEn: "How is my enterprise data protected on Zakir?",
    qAr: "كيف يتم حماية بيانات المؤسسة والملفات على منصة ذاكر؟",
    qFr: "Comment mes données sont-elles protégées ?",
    aEn: "Zakir employs AES-256 end-to-end data encryption, strict RBAC workspace isolation, and isolated server-side security policies backed by Firebase Admin & Cloud SQL.",
    aAr: "تعتمد منصة ذاكر على تشفير AES-256 للبيانات، وعزل تام لمساحات العمل بين المؤسسات، وسياسات أمان صارمة محمية بواسطة خوادم Firebase Admin و Cloud SQL.",
    aFr: "Zakir utilise un chiffrement AES-256, une isolation stricte des espaces de travail et des règles de sécurité Firebase Admin & Cloud SQL."
  }
];

export const CustomerSupport: React.FC<CustomerSupportProps> = ({ currentUser, lang, theme = "dark" }) => {
  const [activeTab, setActiveTab] = useState<"tickets" | "new" | "verification_help" | "faqs">("tickets");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // New Ticket Form State
  const [category, setCategory] = useState<SupportCategory>("Technical Problem");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<SupportPriority>("Medium");
  const [contactEmail, setContactEmail] = useState(currentUser?.email || "");
  const [contactPhone, setContactPhone] = useState(currentUser?.phone || "");
  const [companyNameInput, setCompanyNameInput] = useState(currentUser?.companyName || "");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState("");
  const [submitErrorMsg, setSubmitErrorMsg] = useState("");

  // Reply Form State
  const [replyMessage, setReplyMessage] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [faqSearch, setFaqSearch] = useState("");
  const [openFaqId, setOpenFaqId] = useState<string | null>("faq_1");

  useEffect(() => {
    if (currentUser?.email) setContactEmail(currentUser.email);
    if (currentUser?.phone) setContactPhone(currentUser.phone);
    if (currentUser?.companyName) setCompanyNameInput(currentUser.companyName);
  }, [currentUser]);

  // Load tickets on mount & subscribe to live updates
  const loadTickets = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoadingTickets(true);
    setFetchError("");

    const uId = currentUser?.id || localStorage.getItem("zakir_user_id") || "";
    const uEmail = currentUser?.email || localStorage.getItem("zakir_user_email") || "";

    try {
      const data = await fetchSupportTicketsApi(uId, uEmail, false);
      setTickets(data);
      if (data && data.length > 0) {
        if (!selectedTicket) {
          setSelectedTicket(data[0]);
        } else {
          const fresh = data.find(t => t.id === selectedTicket.id);
          if (fresh) setSelectedTicket(fresh);
        }
      }
    } catch (err: any) {
      console.warn("Failed to fetch support tickets:", err);
      setFetchError(
        lang === "ar" 
          ? "تعذر الاتصال بمركز الدعم الفني مباشرة. جاري العمل بالوضع المحلي الاحتياطي."
          : "Could not connect to support service directly. Using local backup mode."
      );
    } finally {
      setIsLoadingTickets(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadTickets();

    const uId = currentUser?.id || localStorage.getItem("zakir_user_id") || "";
    const unsubscribe = subscribeToSupportTickets(uId, false, (updatedTickets) => {
      if (updatedTickets && updatedTickets.length > 0) {
        setTickets(updatedTickets);
        setSelectedTicket(prev => {
          if (!prev) return updatedTickets[0];
          const match = updatedTickets.find(t => t.id === prev.id);
          return match || prev;
        });
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedTicket?.messages]);

  const handleCreateTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setSubmitErrorMsg(
        lang === "ar" 
          ? "يرجى كتابة عنوان الموضوع وتفاصيل الطلب." 
          : "Please provide both a subject and message details."
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitErrorMsg("");
    setSubmitSuccessMsg("");

    const resolvedUserId = currentUser?.id || localStorage.getItem("zakir_user_id") || `usr_guest_${Date.now()}`;
    const resolvedEmail = contactEmail.trim() || currentUser?.email || localStorage.getItem("zakir_user_email") || "user@zakir.ai";

    try {
      const createdTicket = await createSupportTicketApi({
        userId: resolvedUserId,
        userEmail: resolvedEmail,
        userName: currentUser?.ownerName || currentUser?.companyName || resolvedEmail.split("@")[0],
        userPhone: contactPhone.trim(),
        companyName: companyNameInput.trim() || currentUser?.companyName || "",
        category,
        subject: subject.trim(),
        message: message.trim(),
        priority
      });

      setSubmitSuccessMsg(
        lang === "ar"
          ? `تم تقديم طلبك بنجاح! رقم التذكرة: #${createdTicket.id}. سيرد عليك فريق الدعم والامتثال في أسرع وقت.`
          : lang === "fr"
          ? `Votre demande a été soumise avec succès! Ticket #${createdTicket.id}.`
          : `Your request was submitted successfully! Ticket #${createdTicket.id}.`
      );

      // Reset form
      setSubject("");
      setMessage("");
      setPriority("Medium");
      setAttachments([]);

      // Reload tickets & focus new ticket
      await loadTickets();
      setSelectedTicket(createdTicket);

      setTimeout(() => {
        setActiveTab("tickets");
        setSubmitSuccessMsg("");
      }, 1200);

    } catch (err: any) {
      setSubmitErrorMsg(err.message || (lang === "ar" ? "تعذر تقديم طلب الدعم حالياً." : "Failed to create support ticket."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    setIsSubmittingReply(true);
    try {
      const resolvedName = currentUser?.ownerName || currentUser?.companyName || "Zakir User";
      const resolvedEmail = currentUser?.email || contactEmail || "user@zakir.ai";

      await addSupportTicketMessageApi(selectedTicket.id, {
        senderType: "user",
        senderName: resolvedName,
        senderEmail: resolvedEmail,
        message: replyMessage.trim()
      });

      setReplyMessage("");
      await loadTickets();
    } catch (err: any) {
      console.error("Failed to send support reply:", err);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Quick preset trigger for verification & account recovery
  const triggerPresetRequest = (presetCategory: SupportCategory, presetSubject: string, presetMessage: string) => {
    setCategory(presetCategory);
    setSubject(presetSubject);
    setMessage(presetMessage);
    setPriority("High");
    setActiveTab("new");
  };

  const filteredTickets = tickets.filter(t => {
    const matchesStatus = statusFilter === "All" || t.status === statusFilter;
    const matchesSearch = !searchQuery.trim() || 
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const filteredFaqs = FAQS.filter(faq => {
    if (!faqSearch.trim()) return true;
    const term = faqSearch.toLowerCase();
    return (
      faq.qEn.toLowerCase().includes(term) ||
      faq.qAr.toLowerCase().includes(term) ||
      faq.aEn.toLowerCase().includes(term) ||
      faq.aAr.toLowerCase().includes(term)
    );
  });

  const getStatusBadge = (status: SupportStatus) => {
    switch (status) {
      case "Open":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#0075DE]/10 text-[#0075DE] border border-[#0075DE]/20">
            <Clock className="w-3 h-3" />
            {lang === "ar" ? "مفتوحة" : "Open"}
          </span>
        );
      case "In Progress":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <RefreshCw className="w-3 h-3 animate-spin-slow" />
            {lang === "ar" ? "قيد المتابعة" : "In Progress"}
          </span>
        );
      case "Waiting for User":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <AlertCircle className="w-3 h-3" />
            {lang === "ar" ? "بانتظار إجابتك" : "Waiting for You"}
          </span>
        );
      case "Resolved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            {lang === "ar" ? "تم الحل" : "Resolved"}
          </span>
        );
      case "Closed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            <CheckCircle className="w-3 h-3" />
            {lang === "ar" ? "مغلقة" : "Closed"}
          </span>
        );
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: SupportPriority) => {
    switch (priority) {
      case "Urgent":
        return <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 animate-pulse">{lang === "ar" ? "عاجل جداً" : "Urgent"}</span>;
      case "High":
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30">{lang === "ar" ? "أولوية عالية" : "High"}</span>;
      case "Medium":
      case "Normal":
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#0075DE]/10 text-[#0075DE] border border-[#0075DE]/20">{lang === "ar" ? "متوسطة" : "Medium"}</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-normal bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400">{lang === "ar" ? "عادية" : "Low"}</span>;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 text-slate-900 dark:text-slate-100">
      
      {/* INSTITUTIONAL HEADER & LIVE STATUS BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#0075DE] via-emerald-500 to-[#0075DE]"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#0075DE]/10 text-[#0075DE] border border-[#0075DE]/20 shadow-inner">
                <LifeBuoy className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  {lang === "ar" ? "مركز خدمة ودعم العملاء المؤسسي" : "Enterprise Customer Care & Support Center"}
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono font-normal">
                    v2.5 Live
                  </span>
                </h1>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                  {lang === "ar" 
                    ? "فريق الدعم الفني والامتثال متواجد لخدمتك ومتابعة كافة الطلبات والاستفسارات بدقة عالية" 
                    : "Our enterprise support and compliance team is dedicated to reviewing and handling all your technical and operational inquiries."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80 backdrop-blur-sm self-start md:self-auto">
            <div className="flex items-center gap-2 text-xs">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {lang === "ar" ? "أنظمة الدعم تعمل بكفاءة 100%" : "Systems Operational"}
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800"></div>
            <button 
              onClick={() => loadTickets(true)} 
              disabled={isRefreshing}
              className="flex items-center gap-1.5 text-xs text-[#0075DE] hover:text-[#005BAB] transition-colors font-medium cursor-pointer"
              title={lang === "ar" ? "تحديث التذاكر" : "Refresh Tickets"}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{lang === "ar" ? "تحديث" : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-2 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800/80 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("tickets")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "tickets"
                ? "bg-[#0075DE] text-white shadow-lg shadow-[#0075DE]/20 font-bold"
                : "bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{lang === "ar" ? "تذاكري والمحادثات المباشرة" : "My Support Tickets & Chat"}</span>
            {tickets.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                activeTab === "tickets" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              }`}>
                {tickets.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("new")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "new"
                ? "bg-[#0075DE] text-white shadow-lg shadow-[#0075DE]/20 font-bold"
                : "bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>{lang === "ar" ? "إنشاء طلب دعم جديد" : "Create New Support Ticket"}</span>
          </button>

          <button
            onClick={() => setActiveTab("verification_help")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "verification_help"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 font-bold"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{lang === "ar" ? "مساعدة التوثيق واستعادة الحساب" : "Verification & Access Help"}</span>
          </button>

          <button
            onClick={() => setActiveTab("faqs")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "faqs"
                ? "bg-[#0075DE] text-white shadow-lg shadow-[#0075DE]/20 font-bold"
                : "bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>{lang === "ar" ? "الأسئلة الشائعة ومركز المعرفة" : "FAQs & Knowledge Base"}</span>
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button 
            onClick={() => loadTickets(true)}
            className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold transition-colors shrink-0"
          >
            {lang === "ar" ? "إعادة المحاولة" : "Retry"}
          </button>
        </div>
      )}

      {/* TAB 1: MY TICKETS & LIVE CHAT VIEW */}
      {activeTab === "tickets" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
          
          {/* LEFT COLUMN: TICKET LIST */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col h-[650px]">
            <div className="space-y-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0075DE]" />
                  <span>{lang === "ar" ? "سجل طلبات الدعم" : "Ticket Log"}</span>
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">({filteredTickets.length})</span>
              </div>

              {/* SEARCH & STATUS FILTER */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute right-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === "ar" ? "البحث برقم التذكرة أو الموضوع..." : "Search tickets..."}
                    className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#0075DE]"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {["All", "Open", "In Progress", "Waiting for User", "Resolved"].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        statusFilter === st
                          ? "bg-[#0075DE]/10 text-[#0075DE] border border-[#0075DE]/30"
                          : "bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      {st === "All" ? (lang === "ar" ? "الكل" : "All") : st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* TICKETS SCROLLABLE LIST */}
            <div className="flex-1 overflow-y-auto space-y-2.5 mt-3 pr-1">
              {isLoadingTickets ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#0075DE]" />
                  <span>{lang === "ar" ? "جاري جلب التذاكر..." : "Loading tickets..."}</span>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-60 text-center p-6 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <MessageSquare className="w-10 h-10 text-slate-400 dark:text-slate-600 mb-2" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {lang === "ar" ? "لا توجد تذاكر دعم مسجلة" : "No support tickets found"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {lang === "ar" ? "يمكنك إنشاء طلب دعم جديد وسيقوم الفريق بالرد فوراً." : "Create a new ticket to get help from our team."}
                  </p>
                  <button
                    onClick={() => setActiveTab("new")}
                    className="mt-4 px-3.5 py-1.5 rounded-lg bg-[#0075DE] hover:bg-[#005BAB] text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    {lang === "ar" ? "إنشاء تذكرة الآن" : "Create Ticket"}
                  </button>
                </div>
              ) : (
                filteredTickets.map((ticket) => {
                  const isSelected = selectedTicket?.id === ticket.id;
                  return (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-blue-50 dark:bg-slate-800/90 border-[#0075DE]/50 shadow-md"
                          : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-mono text-[11px] font-bold text-[#0075DE]">
                          #{ticket.id}
                        </span>
                        {getStatusBadge(ticket.status)}
                      </div>

                      <h3 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 mb-1">
                        {ticket.subject}
                      </h3>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                        <span className="truncate max-w-[130px]">
                          {ticket.category}
                        </span>
                        <span className="font-mono text-[10px]">
                          {safeFormatDate(ticket.updatedAt || ticket.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: ACTIVE CONVERSATION THREAD */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col h-[650px]">
            {selectedTicket ? (
              <>
                {/* CHAT HEADER */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 rounded-t-2xl flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#0075DE]">
                        #{selectedTicket.id}
                      </span>
                      {getStatusBadge(selectedTicket.status)}
                      {getPriorityBadge(selectedTicket.priority)}
                    </div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedTicket.subject}
                    </h2>
                  </div>

                  <div className="text-right text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                    <p className="font-medium text-slate-700 dark:text-slate-300">{selectedTicket.category}</p>
                    <p className="text-[10px]">
                      {safeFormatDateTime(selectedTicket.createdAt)}
                    </p>
                  </div>
                </div>

                {/* MESSAGES THREAD SCROLL VIEW */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/50 dark:bg-slate-950/30">
                  {/* ORIGINAL DESCRIPTION CARD */}
                  <div className="bg-white dark:bg-slate-900 border border-blue-100 dark:border-[#0075DE]/20 rounded-xl p-4 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#0075DE]/10 text-[#0075DE] flex items-center justify-center font-bold text-xs">
                          {selectedTicket.userName ? selectedTicket.userName[0].toUpperCase() : "U"}
                        </div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedTicket.userName || selectedTicket.userEmail}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({selectedTicket.userEmail})</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{safeFormatTime(selectedTicket.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedTicket.description || selectedTicket.message}
                    </p>
                  </div>

                  {/* THREAD MESSAGES */}
                  {selectedTicket.messages && selectedTicket.messages.map((msg: SupportMessage) => {
                    const isAdmin = msg.senderType === "admin";
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 max-w-[85%] ${
                          isAdmin ? "mr-auto flex-row" : "ml-auto flex-row-reverse"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                          isAdmin 
                            ? "bg-[#0075DE] text-white shadow-md shadow-[#0075DE]/20" 
                            : "bg-blue-600 text-white"
                        }`}>
                          {isAdmin ? <Bot className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                        </div>

                        <div className={`space-y-1 rounded-2xl p-3.5 text-xs shadow-sm ${
                          isAdmin
                            ? "bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#0075DE]/30 text-slate-800 dark:text-slate-200"
                            : "bg-[#0075DE] text-white"
                        }`}>
                          <div className="flex items-center justify-between gap-4 text-[10px] opacity-80 pb-1 border-b border-current/10 mb-1">
                            <span className="font-bold">{msg.senderName || (isAdmin ? "Zakir Support Team" : "You")}</span>
                            <span className="font-mono">{safeFormatTime(msg.createdAt)}</span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* REPLY INPUT FORM */}
                <form onSubmit={handleSendReply} className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-b-2xl">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder={lang === "ar" ? "اكتب ردك هنا لمتابعة المحادثة مع فريق الدعم..." : "Type your reply to support..."}
                      disabled={isSubmittingReply || selectedTicket.status === "Closed"}
                      className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#0075DE] disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!replyMessage.trim() || isSubmittingReply || selectedTicket.status === "Closed"}
                      className="px-4 py-2.5 rounded-xl bg-[#0075DE] hover:bg-[#005BAB] disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                    >
                      {isSubmittingReply ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{lang === "ar" ? "إرسال" : "Send"}</span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-slate-500">
                <LifeBuoy className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {lang === "ar" ? "اختر تذكرة دعم لمشاهدة تفاصيل المحادثة" : "Select a support ticket to view details"}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {lang === "ar" ? "يمكنك مراجعة كافة التحديثات وردود فريق الدعم الفني بشكل مباشر هنا." : "Review direct responses and progress updates from our team here."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CREATE NEW TICKET FORM */}
      {activeTab === "new" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 max-w-4xl mx-auto shadow-xl">
          <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
              <span>{lang === "ar" ? "تقديم طلب دعم ومساعدة جديد" : "Submit New Support Request"}</span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {lang === "ar"
                ? "سيتم توجيه طلبك فوراً إلى القسم المختص (الامتثال، التوثيق، الدعم الفني، أو الفواتير) لمراجعته فوراً"
                : "Your request will be routed immediately to the appropriate team for expedited review."}
            </p>
          </div>

          {submitSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 dark:text-emerald-400" />
              <span>{submitSuccessMsg}</span>
            </div>
          )}

          {submitErrorMsg && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 dark:text-red-400" />
              <span>{submitErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreateTicketSubmit} className="space-y-5">
            {/* CATEGORY SELECTOR */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                {lang === "ar" ? "تصنيف الطلب *" : "Support Category *"}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {CATEGORY_OPTIONS.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`p-3 rounded-xl border text-right flex items-center gap-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300 font-bold shadow-md"
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isSelected ? "text-amber-500 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"}`} />
                      <span className="text-xs">{lang === "ar" ? cat.ar : cat.en}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SUBJECT & PRIORITY */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {lang === "ar" ? "موضوع الطلب *" : "Subject Line *"}
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={lang === "ar" ? "مثال: عدم استقبال رمز التحقق OTP، أو استفسار بخصوص السجل التجاري..." : "e.g., Unable to receive OTP verification code..."}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {lang === "ar" ? "مستوى الأولوية *" : "Priority Level *"}
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as SupportPriority)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="Normal">{lang === "ar" ? "عادية (استفسار عام)" : "Normal / Low"}</option>
                  <option value="Medium">{lang === "ar" ? "متوسطة (مشكلة تشغيلية)" : "Medium"}</option>
                  <option value="High">{lang === "ar" ? "عالية (تأثير على الحساب)" : "High"}</option>
                  <option value="Urgent">{lang === "ar" ? "عاجلة جداً (توقف الخدمة/توثيق)" : "Urgent (System Down)"}</option>
                </select>
              </div>
            </div>

            {/* CONTACT DETAILS PRE-FILLED */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {lang === "ar" ? "البريد الإلكتروني للرد" : "Contact Email"}
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {lang === "ar" ? "رقم الهاتف / الواتساب" : "Contact Phone"}
                </label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+222..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {lang === "ar" ? "اسم الشركة / المؤسسة" : "Company Name"}
                </label>
                <input
                  type="text"
                  value={companyNameInput}
                  onChange={(e) => setCompanyNameInput(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            {/* DETAILED MESSAGE */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {lang === "ar" ? "تفاصيل الطلب والرسالة *" : "Detailed Explanation *"}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder={lang === "ar" ? "اشرح مشكلتك بالتفصيل واذكر أي خطوات قمت بها..." : "Explain your issue or question in detail..."}
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500/50 leading-relaxed"
              />
            </div>

            {/* SUBMIT BUTTON */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab("tickets")}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !subject.trim() || !message.trim()}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{lang === "ar" ? "إرسال طلب الدعم الآن" : "Submit Ticket"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: VERIFICATION & ACCESS FAST-TRACK HELP */}
      {activeTab === "verification_help" && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-emerald-500/10 via-white to-slate-50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 border border-emerald-500/30 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {lang === "ar" ? "المسار السريع: مساعدة التوثيق وتفعيل الحساب" : "Fast-Track Account Verification & Access Support"}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {lang === "ar"
                    ? "هل تواجه مشكلة في وصول رمز التوثيق (OTP) أو رفع وثائق المؤسسة والسجل التجاري؟ اختر نوع المشكلة وسيتم إنشاء طلب عاجل لمراجعتها فوراً"
                    : "Having issues receiving verification OTP codes or uploading corporate registration documents? Select an issue to submit a priority request."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div 
                onClick={() => triggerPresetRequest(
                  "Verification Issue",
                  lang === "ar" ? "لم يصلني رمز التوثيق OTP عبر البريد الإلكتروني" : "Did not receive OTP verification code",
                  lang === "ar" ? "قمت بطلب رمز التحقق لتوثيق حسابي ولم أستلم البريد. يرجى مراجعة تفعيل بريدي الإلكتروني يدوياً." : "I requested a verification code to activate my account but did not receive the email. Please review and activate my account."
                )}
                className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-emerald-500/20 hover:border-emerald-500/50 cursor-pointer transition-all space-y-2 group shadow-sm"
              >
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <Mail className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-emerald-500" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {lang === "ar" ? "لم يصلني رمز التحقق (OTP)" : "OTP Code Not Arriving"}
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {lang === "ar" ? "فتح طلب توثيق يدوي عاجل مع فريق الامتثال" : "Open manual verification request with compliance."}
                </p>
              </div>

              <div 
                onClick={() => triggerPresetRequest(
                  "Verification Issue",
                  lang === "ar" ? "طلب مراجعة السجل التجاري والوثائق المؤسسية" : "Corporate document review request",
                  lang === "ar" ? "قمنا برفع الوثائق والسجل التجاري في منصة ذاكر. يرجى توثيق حساب المؤسسة وتأكيد التفعيل." : "We uploaded our commercial registration files. Please review and verify our corporate account."
                )}
                className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-emerald-500/20 hover:border-emerald-500/50 cursor-pointer transition-all space-y-2 group shadow-sm"
              >
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <FileText className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-emerald-500" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {lang === "ar" ? "توثيق الوثائق والسجل التجاري" : "Corporate Document Verification"}
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {lang === "ar" ? "اعتماد السجل التجاري وتفعيل الشارة الزرقاء" : "Approve commercial registration and grant verified badge."}
                </p>
              </div>

              <div 
                onClick={() => triggerPresetRequest(
                  "Account Problem",
                  lang === "ar" ? "طلب استعادة الوصول إلى الحساب وتغيير البريد" : "Account access recovery request",
                  lang === "ar" ? "أرغب في تغيير بريد الحساب وتعديل معلومات الوصول. يرجى التواصل معي للتحقق من ملكية الحساب." : "I would like to update account email and access details. Please contact me for ownership verification."
                )}
                className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-emerald-500/20 hover:border-emerald-500/50 cursor-pointer transition-all space-y-2 group shadow-sm"
              >
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <Key className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-emerald-500" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {lang === "ar" ? "استعادة الوصول وتحديث البيانات" : "Account Access Recovery"}
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {lang === "ar" ? "تعديل بريد المسؤول وإعادة تعيين كلمة المرور" : "Update admin email and reset master password."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: FAQS & KNOWLEDGE BASE */}
      {activeTab === "faqs" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 max-w-4xl mx-auto shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                <span>{lang === "ar" ? "مركز المعرفة والأسئلة الشائعة" : "Knowledge Base & FAQs"}</span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {lang === "ar" ? "إجابات سريعة ومفصلة حول التوثيق، الحسابات، والأمان في منصة ذاكر" : "Quick answers about verification, accounts, and security in Zakir."}
              </p>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                placeholder={lang === "ar" ? "ابحث في الأسئلة..." : "Search FAQs..."}
                className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredFaqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    className="w-full p-4 text-right flex items-center justify-between gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <span className="text-xs md:text-sm font-bold text-slate-900 dark:text-white">
                      {lang === "ar" ? faq.qAr : faq.qEn}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? "rotate-180 text-amber-500 dark:text-amber-400" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="p-4 pt-0 text-xs text-slate-700 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-800/50 bg-slate-100/50 dark:bg-slate-900/50">
                      {lang === "ar" ? faq.aAr : faq.aEn}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-2 mt-6">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
              {lang === "ar" ? "لم تجد إجابة لسؤالك؟" : "Didn't find an answer to your question?"}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              {lang === "ar" ? "فريق الدعم الفني جاهز للإجابة على جميع استفساراتك فوراً" : "Our support team is ready to assist you right now."}
            </p>
            <button
              onClick={() => setActiveTab("new")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors mt-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{lang === "ar" ? "إنشاء تذكرة دعم جديدة" : "Open a Support Ticket"}</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
