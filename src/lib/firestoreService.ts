import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  generateQrToken,
  generateRegistrationNumber,
  generateSecureId,
  isValidPhoneNumber,
  normalizePhoneNumber,
  sha256Hex,
  slugifyId,
} from './crypto';
import {
  BranchItem,
  DEFAULT_EVENT_SETTINGS,
  EventPoster,
  EventSettings,
  ParticipantPublic,
} from '../types/pyjama';

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return new Date();
}

function toNullableDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return null;
}

function mapParticipantPublic(id: string, data: Record<string, unknown>): ParticipantPublic {
  return {
    id,
    numero_inscription: String(data.numero_inscription || ''),
    nom: String(data.nom || ''),
    prenom: String(data.prenom || ''),
    branche_id: String(data.branche_id || ''),
    branche_nom: String(data.branche_nom || ''),
    service_id: String(data.service_id || ''),
    service_nom: String(data.service_nom || ''),
    qr_token: String(data.qr_token || ''),
    public_visible: Boolean(data.public_visible),
    statut_entree: Boolean(data.statut_entree),
    date_entree: toNullableDate(data.date_entree),
    created_at: toDate(data.created_at),
  };
}

export function subscribeEventSettings(
  onData: (settings: EventSettings) => void
): () => void {
  const ref = doc(db, 'event_settings', 'main');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_EVENT_SETTINGS);
        return;
      }
      const d = snap.data();
      onData({
        titre: String(d.titre ?? DEFAULT_EVENT_SETTINGS.titre),
        description: String(d.description ?? DEFAULT_EVENT_SETTINGS.description),
        affiche_present: Boolean(d.affiche_present),
        affiche_fit: d.affiche_fit === 'cover' ? 'cover' : 'contain',
        affiche_position:
          d.affiche_position === 'top' || d.affiche_position === 'bottom'
            ? d.affiche_position
            : 'center',
        theme_primary: String(d.theme_primary ?? DEFAULT_EVENT_SETTINGS.theme_primary),
        theme_accent: String(d.theme_accent ?? DEFAULT_EVENT_SETTINGS.theme_accent),
        affichage_public_participants:
          typeof d.affichage_public_participants === 'boolean'
            ? d.affichage_public_participants
            : true,
        updated_at: toNullableDate(d.updated_at),
      });
    },
    (err) => handleFirestoreError(err, OperationType.GET, 'event_settings/main')
  );
}

export function subscribeEventPoster(
  onData: (poster: EventPoster | null) => void
): () => void {
  const ref = doc(db, 'event_posters', 'official');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        data_url: String(d.data_url || ''),
        mime_type: (d.mime_type as EventPoster['mime_type']) || 'image/webp',
        file_name: String(d.file_name || 'affiche'),
        width: Number(d.width || 1200),
        height: Number(d.height || 800),
        updated_at: toNullableDate(d.updated_at),
      });
    },
    (err) => handleFirestoreError(err, OperationType.GET, 'event_posters/official')
  );
}

export function subscribePublicParticipants(
  onData: (participants: ParticipantPublic[]) => void
): () => void {
  const q = query(
    collection(db, 'participants_public'),
    where('public_visible', '==', true)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapParticipantPublic(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'participants_public')
  );
}

export interface RegisterInput {
  nom: string;
  prenom: string;
  contact: string;
  branche: BranchItem;
  serviceName: string;
}

export async function registerParticipant(
  input: RegisterInput
): Promise<ParticipantPublic> {
  const nom = input.nom.trim().slice(0, 80);
  const prenom = input.prenom.trim().slice(0, 80);
  const serviceNom = input.serviceName.trim().slice(0, 80);
  const serviceId = slugifyId(serviceNom);
  const normalizedPhone = normalizePhoneNumber(input.contact);

  if (nom.length < 1 || prenom.length < 1) {
    throw new Error('Veuillez renseigner votre nom et votre prénom.');
  }
  if (serviceNom.length < 2) {
    throw new Error('Veuillez saisir le nom de votre service.');
  }
  if (!isValidPhoneNumber(normalizedPhone)) {
    throw new Error(
      'Numéro de téléphone invalide. Exemple attendu : +225 07 08 09 10 11.'
    );
  }

  const phoneHash = await sha256Hex(normalizedPhone);
  const participantId = generateSecureId(24);
  const qrToken = generateQrToken();
  const numeroInscription = generateRegistrationNumber();
  const nowClient = new Date();

  const batch = writeBatch(db);
  const publicRef = doc(db, 'participants_public', participantId);
  const privateRef = doc(db, 'participants_private', participantId);
  const lockRef = doc(db, 'registration_locks', phoneHash);

  batch.set(publicRef, {
    numero_inscription: numeroInscription,
    nom,
    prenom,
    branche_id: input.branche.id,
    branche_nom: input.branche.nom_branche.slice(0, 80),
    service_id: serviceId,
    service_nom: serviceNom,
    qr_token: qrToken,
    public_visible: true,
    statut_entree: false,
    date_entree: null,
    created_at: serverTimestamp(),
  });

  batch.set(privateRef, {
    participant_id: participantId,
    contact: normalizedPhone,
    phone_hash: phoneHash,
    created_at: serverTimestamp(),
  });

  batch.set(lockRef, {
    participant_id: participantId,
    created_at: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('already exists') || msg.includes('permission') || msg.includes('insufficient')) {
      throw new Error(
        'Ce numéro de téléphone est déjà inscrit ou l’inscription n’a pas pu être validée.'
      );
    }
    handleFirestoreError(err, OperationType.WRITE, 'participants_public');
  }

  return {
    id: participantId,
    numero_inscription: numeroInscription,
    nom,
    prenom,
    branche_id: input.branche.id,
    branche_nom: input.branche.nom_branche,
    service_id: serviceId,
    service_nom: serviceNom,
    qr_token: qrToken,
    public_visible: true,
    statut_entree: false,
    date_entree: null,
    created_at: nowClient,
  };
}

export async function saveOfficialPoster(
  poster: Omit<EventPoster, 'updated_at'>,
  settings: Omit<EventSettings, 'updated_at'>
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'event_posters', 'official'), {
      data_url: poster.data_url,
      mime_type: poster.mime_type,
      file_name: poster.file_name,
      width: poster.width,
      height: poster.height,
      updated_at: serverTimestamp(),
    });
    batch.set(doc(db, 'event_settings', 'main'), {
      ...settings,
      affiche_present: true,
      updated_at: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'event_posters/official');
  }
}

export async function updatePosterDisplaySettings(
  settings: Omit<EventSettings, 'updated_at'>
): Promise<void> {
  try {
    await setDoc(doc(db, 'event_settings', 'main'), {
      ...settings,
      updated_at: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'event_settings/main');
  }
}

export async function deleteOfficialPoster(
  settings: Omit<EventSettings, 'updated_at'>
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'event_posters', 'official'));
    batch.set(doc(db, 'event_settings', 'main'), {
      ...settings,
      affiche_present: false,
      theme_primary: '#1E1B4B',
      theme_accent: '#D97706',
      updated_at: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'event_posters/official');
  }
}

export async function lookupParticipantByTokenOrCode(
  rawCode: string
): Promise<ParticipantPublic | null> {
  const code = rawCode.trim();
  if (!code) return null;

  try {
    const isTicketNum = code.toUpperCase().startsWith('PYJ-');
    const q = isTicketNum
      ? query(
          collection(db, 'participants_public'),
          where('numero_inscription', '==', code.toUpperCase())
        )
      : query(collection(db, 'participants_public'), where('qr_token', '==', code));

    const snap = await getDocs(q);
    if (snap.empty) return null;

    const docSnap = snap.docs[0];
    return mapParticipantPublic(docSnap.id, docSnap.data() as Record<string, unknown>);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'participants_public');
  }
}

export async function validateParticipantPresence(
  participantId: string
): Promise<{ status: 'validated' | 'already_used' | 'not_found'; dateEntree: Date | null }> {
  const ref = doc(db, 'participants_public', participantId);
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        return { status: 'not_found' as const, dateEntree: null };
      }
      const data = snap.data();
      if (data.statut_entree === true) {
        return {
          status: 'already_used' as const,
          dateEntree: toNullableDate(data.date_entree),
        };
      }
      tx.update(ref, {
        statut_entree: true,
        date_entree: serverTimestamp(),
      });
      return { status: 'validated' as const, dateEntree: new Date() };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `participants_public/${participantId}`);
  }
}

export async function resetParticipantPresence(
  participantId: string
): Promise<{ status: 'reset' | 'already_absent' | 'not_found' }> {
  const ref = doc(db, 'participants_public', participantId);
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        return { status: 'not_found' as const };
      }
      const data = snap.data();
      if (data.statut_entree !== true) {
        return { status: 'already_absent' as const };
      }
      tx.update(ref, {
        statut_entree: false,
        date_entree: null,
      });
      return { status: 'reset' as const };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `participants_public/${participantId}`);
  }
}
