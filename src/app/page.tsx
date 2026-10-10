'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Image as ImageIcon,
  Bell,
  BellOff,
  LogOut,
  X,
  CheckCircle2,
  Lock,
  User,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface AuthUser {
  id: number;
  username: string;
}

interface ContactUser {
  id: number;
  username: string;
  created_at: string;
}

interface ChatMessage {
  id: number;
  sender_id: number;
  recipient_id: number | null;
  sender_username: string;
  content: string | null;
  media_path: string | null;
  created_at: string;
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

export default function ChatApp() {
  // État d'authentification
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [contacts, setContacts] = useState<ContactUser[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Formulaire de connexion
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // État de la messagerie
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // État WebSocket & Présence
  const [wsConnected, setWsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<number[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<number, boolean>>({});

  // Push Notifications
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  // Lightbox photo
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectedRecipientIdRef = useRef<number | null>(null);
  selectedRecipientIdRef.current = selectedRecipientId;

  // Défilement automatique vers le dernier message
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  // Vérifier la session active
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        const nextContacts: ContactUser[] = data.contacts || [];
        setContacts(nextContacts);
        setSelectedRecipientId((previousId) => {
          if (previousId && nextContacts.some((contact) => contact.id === previousId)) {
            return previousId;
          }
          return nextContacts[0]?.id ?? null;
        });
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  // Initialisation PWA & Service Worker
  useEffect(() => {
    checkSession();

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.pushManager.getSubscription().then((sub) => {
            if (sub) {
              setPushSubscribed(true);
            }
          });
        })
        .catch((err) => {
          console.warn('Enregistrement SW échoué:', err);
        });
    }
  }, [checkSession]);

  // Chargement de l'historique des messages
  const loadMessages = useCallback(async () => {
    if (!currentUser || !selectedRecipientId) {
      setMessages([]);
      return;
    }
    try {
      const res = await fetch(`/api/messages?limit=100&recipientId=${selectedRecipientId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setTimeout(() => scrollToBottom(false), 100);
      }
    } catch (err) {
      console.error('Erreur chargement messages:', err);
    }
  }, [currentUser, selectedRecipientId, scrollToBottom]);

  useEffect(() => {
    if (currentUser && selectedRecipientId) {
      loadMessages();
    }
  }, [currentUser, selectedRecipientId, loadMessages]);

  // Connexion WebSocket
  useEffect(() => {
    if (!currentUser) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
      return;
    }

    const sessionUserId = currentUser.id;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    let socket: WebSocket | null = null;
    let pingInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let shouldReconnect = true;

    function connect() {
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;
      const currentSocket = socket;

      currentSocket.onopen = () => {
        if (wsRef.current !== currentSocket) return;
        setWsConnected(true);
        pingInterval = setInterval(() => {
          if (currentSocket.readyState === WebSocket.OPEN) {
            currentSocket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      currentSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connected') {
            setOnlineUserIds(data.onlineUserIds || []);
          } else if (data.type === 'presence') {
            setOnlineUserIds(data.onlineUserIds || []);
          } else if (data.type === 'new_message') {
            const incoming = data.message as ChatMessage;
            const currentPeerId = selectedRecipientIdRef.current;
            const belongsToOpenConversation =
              currentPeerId !== null &&
              ((incoming.sender_id === currentPeerId && incoming.recipient_id === sessionUserId) ||
                (incoming.sender_id === sessionUserId && incoming.recipient_id === currentPeerId));

            if (!belongsToOpenConversation) {
              return;
            }

            setMessages((prev) => {
              if (prev.some((existing) => existing.id === incoming.id)) {
                return prev;
              }
              return [...prev, incoming];
            });
            setTimeout(() => scrollToBottom(true), 50);
          } else if (data.type === 'user_typing') {
            setTypingUsers((prev) => ({
              ...prev,
              [data.userId]: data.isTyping,
            }));
          } else if (data.type === 'error') {
            console.error('Erreur reçue du WebSocket:', data.message);
            alert(`Erreur: ${data.message}`);
          }
        } catch (err) {
          console.error('Erreur lecture websocket message:', err);
        }
      };

      currentSocket.onclose = () => {
        if (wsRef.current === currentSocket) {
          setWsConnected(false);
          wsRef.current = null;
        }
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        if (shouldReconnect) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };

      currentSocket.onerror = () => {
        currentSocket.close();
      };
    }

    connect();

    return () => {
      shouldReconnect = false;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) socket.close();
    };
  }, [currentUser, scrollToBottom]);

  // Gestion de la souscription Web Push VAPID
  const handleSubscribePush = async () => {
    if (!pushSupported) {
      setPushMessage('Les notifications push ne sont pas supportées sur ce navigateur.');
      return;
    }

    setPushLoading(true);
    setPushMessage(null);

    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setPushMessage('Permission de notification refusée par l’utilisateur.');
        setPushLoading(false);
        return;
      }

      const keyRes = await fetch('/api/push/public-key');
      if (!keyRes.ok) {
        throw new Error('Impossible de récupérer la clé VAPID publique');
      }
      const { publicKey } = await keyRes.json();

      const reg = await navigator.serviceWorker.ready;
      const convertedKey = urlBase64ToUint8Array(publicKey);

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });

      const subJson = subscription.toJSON();
      const saveRes = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
          },
        }),
      });

      if (saveRes.ok) {
        setPushSubscribed(true);
        setPushMessage('Notifications Push activées avec succès !');
        setTimeout(() => setPushMessage(null), 4000);
      } else {
        throw new Error('Échec de l’enregistrement de la souscription');
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Erreur push subscription:', error);
      setPushMessage(`Erreur: ${error.message}`);
    } finally {
      setPushLoading(false);
    }
  };

  // Gestion de la saisie utilisateur (Typing Indicator)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'typing',
          recipientId: selectedRecipientId,
          isTyping: true,
        })
      );

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'typing',
              recipientId: selectedRecipientId,
              isTyping: false,
            })
          );
        }
      }, 2000);
    }
  };

  // Sélection de photo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image (JPG, PNG, WEBP, GIF, HEIC).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert('Image trop volumineuse (maximum 15 Mo).');
      return;
    }

    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Envoi de message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending || !selectedRecipientId || (!messageText.trim() && !selectedImage)) return;

    setIsSending(true);
    let uploadedMediaPath: string | null = null;

    try {
      // Si une photo est sélectionnée, procéder à l'upload d'abord
      if (selectedImage) {
        const formData = new FormData();
        formData.append('file', selectedImage);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || 'Erreur lors du téléversement de la photo');
        }

        const uploadData = await uploadRes.json();
        uploadedMediaPath = uploadData.mediaPath;
      }

      const content = messageText.trim() || null;

      // Envoi prioritaire par WebSocket si connecté
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'chat_message',
            recipientId: selectedRecipientId,
            content,
            mediaPath: uploadedMediaPath,
          })
        );
      } else {
        // Fallback REST si WebSocket temporairement déconnecté
        const restRes = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientId: selectedRecipientId,
            content,
            mediaPath: uploadedMediaPath,
          }),
        });

        if (restRes.ok) {
          const data = await restRes.json();
          setMessages((prev) => [...prev, data.message]);
          setTimeout(() => scrollToBottom(true), 50);
        }
      }

      // Nettoyage de la saisie
      setMessageText('');
      handleClearImage();
    } catch (err: unknown) {
      const error = err as Error;
      alert(`Erreur d'envoi: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Connexion
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput,
          password: passwordInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Identifiants incorrects');
        return;
      }

      await checkSession();
    } catch {
      setLoginError('Erreur de connexion au serveur');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Déconnexion
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      setMessages([]);
      setSelectedRecipientId(null);
      if (wsRef.current) wsRef.current.close();
    } catch (err) {
      console.error('Erreur déconnexion:', err);
    }
  };

  // Affichage du chargement initial
  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#121212]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 text-sm">Chargement de la messagerie...</p>
        </div>
      </div>
    );
  }

  // Écran de Connexion
  if (!currentUser) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-[#121212] safe-top safe-bottom">
        <div className="w-full max-w-md bg-[#1f2937] rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-700/50">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-3">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Messagerie Privée</h1>
            <p className="text-sm text-gray-400 mt-1">Espace sécurisé et auto-hébergé</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-900/40 border border-red-700/50 text-red-200 text-xs rounded-xl">
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Nom d’utilisateur
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="ex: utilisateur1"
                  className="w-full bg-[#121212] border border-gray-700 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#121212] border border-gray-700 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-blue-600/30 active:scale-[0.98] disabled:opacity-50"
            >
              {isLoggingIn ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-700/60 text-xs text-gray-400 space-y-1">
            <p className="font-medium text-gray-300">Comptes de test configurés :</p>
            <p className="font-mono text-gray-400">
              • <span className="text-blue-400">utilisateur1</span> / password123
            </p>
            <p className="font-mono text-gray-400">
              • <span className="text-blue-400">utilisateur2</span> / password123
            </p>
          </div>
        </div>
      </main>
    );
  }

  const interlocutor = contacts.find((c) => c.id === selectedRecipientId);
  const isInterlocutorOnline = interlocutor ? onlineUserIds.includes(interlocutor.id) : false;
  const isInterlocutorTyping = interlocutor ? !!typingUsers[interlocutor.id] : false;

  return (
    <div className="flex flex-col h-screen bg-[#121212] select-text">
      {/* Barre d'en-tête (Header) */}
      <header className="bg-[#1f2937] border-b border-gray-800 safe-top px-4 py-3 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-base shadow">
              {interlocutor?.username.charAt(0).toUpperCase() || 'M'}
            </div>
            {/* Statut de présence du destinataire */}
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#1f2937] ${
                isInterlocutorOnline ? 'bg-emerald-500' : 'bg-gray-500'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              {contacts.length > 1 ? (
                <label className="sr-only" htmlFor="contact-select">
                  Destinataire
                </label>
              ) : null}
              {contacts.length > 1 ? (
                <select
                  id="contact-select"
                  value={selectedRecipientId ?? ''}
                  onChange={(event) => setSelectedRecipientId(Number(event.target.value))}
                  className="bg-transparent text-sm font-semibold text-white focus:outline-none"
                >
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id} className="text-gray-900">
                      {contact.username}
                    </option>
                  ))}
                </select>
              ) : (
                <h2 className="text-sm font-semibold text-white">
                  {interlocutor?.username || 'Discussion'}
                </h2>
              )}
              {/* Statut WebSocket local */}
              {wsConnected ? (
                <span title="Connecté au direct" className="inline-flex">
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                </span>
              ) : (
                <span title="Reconnexion..." className="inline-flex">
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {isInterlocutorTyping ? (
                <span className="text-blue-400 font-medium animate-pulse">écrit...</span>
              ) : isInterlocutorOnline ? (
                <span className="text-emerald-400">En ligne</span>
              ) : (
                'Hors-ligne (reçoit en push)'
              )}
            </p>
          </div>
        </div>

        {/* Actions droite : Bouton Push et Déconnexion */}
        <div className="flex items-center gap-2">
          {pushSupported && (
            <button
              onClick={handleSubscribePush}
              disabled={pushLoading || pushSubscribed}
              title={pushSubscribed ? 'Notifications Push Actives' : 'Activer les notifications push'}
              className={`p-2 rounded-xl transition-all ${
                pushSubscribed
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 active:scale-95'
              }`}
            >
              {pushSubscribed ? (
                <Bell className="w-4 h-4 fill-emerald-400/20" />
              ) : (
                <BellOff className="w-4 h-4 text-amber-400" />
              )}
            </button>
          )}

          <button
            onClick={handleLogout}
            title="Se déconnecter"
            className="p-2 bg-gray-800 hover:bg-red-500/20 text-gray-300 hover:text-red-400 rounded-xl transition-all active:scale-95"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Message de confirmation Push */}
      {pushMessage && (
        <div className="bg-blue-600/90 text-white text-xs py-2 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{pushMessage}</span>
          </div>
          <button onClick={() => setPushMessage(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Zone des Messages (Feed) */}
      <main className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 px-6">
            <Lock className="w-12 h-12 text-gray-600 mb-2" />
            <p className="text-base font-semibold text-gray-400">Aucun message pour le moment</p>
            <p className="text-xs text-gray-600 mt-1 max-w-xs">
              Les messages et photos échangés restent stockés exclusivement sur votre serveur local.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUser.id;
            const timeStr = new Date(msg.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[82%] sm:max-w-md rounded-2xl p-3 shadow-md ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-[#1f2937] text-gray-100 rounded-bl-none border border-gray-700/60'
                  }`}
                >
                  {/* Photo si présente */}
                  {msg.media_path && (
                    <div className="mb-2 rounded-xl overflow-hidden cursor-pointer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={msg.media_path}
                        alt="Photo partagée"
                        onClick={() => setFullScreenImage(msg.media_path)}
                        className="w-full max-h-72 object-cover rounded-xl hover:opacity-95 transition-opacity"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Contenu textuel */}
                  {msg.content && (
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  )}

                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                      isMe ? 'text-blue-200' : 'text-gray-400'
                    }`}
                  >
                    <span>{timeStr}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Prévisualisation de l'image avant l'envoi */}
      {imagePreviewUrl && (
        <div className="bg-[#1a2230] border-t border-gray-800 p-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-blue-500/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreviewUrl} alt="Aperçu" className="w-full h-full object-cover" />
            </div>
            <div className="text-xs">
              <p className="text-gray-200 font-medium truncate max-w-[200px]">
                {selectedImage?.name}
              </p>
              <p className="text-gray-400">
                {selectedImage ? `${(selectedImage.size / 1024).toFixed(0)} Ko` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleClearImage}
            className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Barre de saisie (Input Bar) */}
      <footer className="bg-[#1f2937] border-t border-gray-800 safe-bottom px-3 py-2.5 shrink-0">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* Bouton Ajout Photo */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Joindre une photo"
            className="p-2.5 text-gray-300 hover:text-white bg-[#121212] hover:bg-gray-800 border border-gray-700 rounded-2xl transition-colors active:scale-95"
          >
            <ImageIcon className="w-5 h-5 text-blue-400" />
          </button>

          {/* Champ texte */}
          <input
            type="text"
            value={messageText}
            onChange={handleInputChange}
            placeholder="Écrivez un message..."
            className="flex-1 bg-[#121212] border border-gray-700 text-white rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />

          {/* Bouton Envoyer */}
          <button
            type="submit"
            disabled={isSending || !selectedRecipientId || (!messageText.trim() && !selectedImage)}
            className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all shadow-md shadow-blue-600/30 disabled:opacity-40 disabled:pointer-events-none active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </footer>

      {/* Modal Plein Écran (Lightbox) pour Photo */}
      {fullScreenImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setFullScreenImage(null)}
        >
          <button
            onClick={() => setFullScreenImage(null)}
            className="absolute top-6 right-6 p-2 bg-gray-800/80 text-white rounded-full hover:bg-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullScreenImage}
            alt="Plein écran"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
