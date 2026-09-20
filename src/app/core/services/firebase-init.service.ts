import { Injectable, inject } from '@angular/core';
import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../../../environments/firebase';

@Injectable({ providedIn: 'root' })
export class FirebaseInitService {
  readonly app = getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig);
  readonly db = getFirestore(this.app);
  readonly auth = getAuth(this.app);
}
