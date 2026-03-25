import React from "react";

const AuthContext = React.createContext({
  session: null,
  user: null,
  loading: true,
  isEmailVerified: false,
  lastAuthEvent: "",
  recoveryMode: false,
  signUpWithPassword: async () => {},
  signInWithPassword: async () => {},
  resendSignupVerification: async () => {},
  sendPasswordReset: async () => {},
  updatePassword: async () => {},
  signOut: async () => {},
});

export default AuthContext;
