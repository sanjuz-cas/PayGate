import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./pages/App";
import { WalletConnectProvider } from "./wallet/WalletConnectContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WalletConnectProvider><App /></WalletConnectProvider>
  </React.StrictMode>,
);
