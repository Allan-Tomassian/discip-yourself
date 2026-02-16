import React from "react";

const AuthContext = React.createContext({
  session: null,
  user: null,
  loading: true,
  signInWithEmail: async () => {},
  signOut: async () => {},
});

export default AuthContext;
