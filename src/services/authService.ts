import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User,
  type UserCredential
} from 'firebase/auth';
import { auth } from '../firebase/config';

const googleProvider = new GoogleAuthProvider();

// Configure Google provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

interface AuthResult {
  user: User | null;
  error: string | null;
}

interface LogoutResult {
  error: string | null;
}

export const registerUser = async (email: string, password: string): Promise<AuthResult> => {
  try {
    const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An error occurred during registration';
    return { user: null, error: errorMessage };
  }
};

export const loginUser = async (email: string, password: string): Promise<AuthResult> => {
  try {
    const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An error occurred during login';
    return { user: null, error: errorMessage };
  }
};

export const loginWithGoogle = async (): Promise<AuthResult> => {
  try {
    const result: UserCredential = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An error occurred during Google login';
    return { user: null, error: errorMessage };
  }
};

export const logoutUser = async (): Promise<LogoutResult> => {
  try {
    await signOut(auth);
    return { error: null };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An error occurred during logout';
    console.error('Logout error:', errorMessage);
    return { error: errorMessage };
  }
};

export const onAuthStateChange = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, callback);
};

// Helper function to get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};