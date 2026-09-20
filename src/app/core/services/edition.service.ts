import { Injectable, inject, signal } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { type Edition, CLASSIC_SPAIN, CLASSIC_USA, MILLIONAIRE } from '../constants/editions';
import { FirebaseInitService } from './firebase-init.service';
import { IdService } from './id.service';

@Injectable({ providedIn: 'root' })
export class EditionService {
  private readonly firebase = inject(FirebaseInitService);
  private readonly id = inject(IdService);
  private readonly db = this.firebase.db;
  private readonly customCol = 'editions';

  readonly editions = signal<Edition[]>([]);
  readonly loading = signal(true);

  constructor() {
    this.loadCustomEditions();
  }

  private loadCustomEditions(): void {
    const q = query(collection(this.db, this.customCol), orderBy('name'));
    onSnapshot(
      q,
      (snapshot) => {
        const custom = snapshot.docs.map((d) => ({ ...(d.data() as Edition) }));
        this.editions.set([CLASSIC_SPAIN, CLASSIC_USA, MILLIONAIRE, ...custom]);
        this.loading.set(false);
      },
      () => {
        this.editions.set([CLASSIC_SPAIN, CLASSIC_USA, MILLIONAIRE]);
        this.loading.set(false);
      },
    );
  }

  async getById(id: string): Promise<Edition | undefined> {
    const found = this.editions().find((e) => e.id === id);
    if (found) return found;
    const snap = await getDoc(doc(this.db, this.customCol, id));
    return snap.exists() ? (snap.data() as Edition) : undefined;
  }

  async save(edition: Omit<Edition, 'id'> & { id?: string }): Promise<Edition> {
    const id = edition.id || this.id.newId();
    const toSave: Edition = { ...edition, id, isCustom: true, readonly: false } as Edition;
    await setDoc(doc(this.db, this.customCol, id), toSave);
    return toSave;
  }

  async update(id: string, changes: Partial<Edition>): Promise<void> {
    await updateDoc(doc(this.db, this.customCol, id), changes);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.db, this.customCol, id));
  }

  async list(): Promise<Edition[]> {
    const q = query(collection(this.db, this.customCol), orderBy('name'));
    const snap = await getDocs(q);
    const custom = snap.docs.map((d) => d.data() as Edition);
    return [CLASSIC_SPAIN, CLASSIC_USA, MILLIONAIRE, ...custom];
  }
}
