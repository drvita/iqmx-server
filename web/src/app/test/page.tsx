"use client";

import React, { useEffect, useState } from "react";

// Declaración de tipos para el SDK de Facebook en window
declare global {
  interface Window {
    FB: {
      init: (params: {
        appId: string;
        cookie: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: fb.AuthResponse) => void,
        params: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit: () => void;
  }

  namespace fb {
    interface AuthResponse {
      authResponse?: {
        code: string;
        accessToken?: string;
        userID?: string;
      };
      status?: string;
    }
  }
}

const WhatsAppSignup = () => {
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [sdkResponse, setSdkResponse] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    // Prevent loading multiple times
    if (window.FB) return;

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: "1560064249064360",
        cookie: true,
        xfbml: false,
        version: "v25.0",
      });
      console.log("Facebook SDK initialized");
    };

    const loadSDK = () => {
      if (document.getElementById("facebook-jssdk")) return;

      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";

      document.body.appendChild(script);
    };

    loadSDK();
  }, []);

  const fbLoginCallback = (response: fb.AuthResponse) => {
    setLoading(false);

    if (response.authResponse) {
      const code = response.authResponse.code;

      // IMPORTANT:
      // Send this code to your backend
      // Exchange it server-to-server for an access token
      setSessionInfo(code);
      console.log("Authorization Code:", code);
    }

    setSdkResponse(response);
  };

  const launchWhatsAppSignup = () => {
    if (!window.FB) {
      alert("Facebook SDK not loaded yet.");
      return;
    }

    setLoading(true);

    window.FB.login(fbLoginCallback, {
      config_id: "968187492720390",
      response_type: "code",
      override_default_response_type: true,
      extras: {
        version: "v4",
        featureType: "whatsapp_business_app_onboarding",
      },
    });
  };

  return (
    <div
      style={{ padding: "20px", fontFamily: "Helvetica, Arial, sans-serif" }}
    >
      <button
        onClick={launchWhatsAppSignup}
        style={{
          backgroundColor: "#1877f2",
          border: 0,
          borderRadius: "4px",
          color: "#fff",
          cursor: "pointer",
          fontSize: "16px",
          fontWeight: "bold",
          height: "40px",
          padding: "0 24px",
        }}
      >
        {loading ? "Processing..." : "Login with Facebook"}
      </button>

      <h3>Session Info Response:</h3>
      <pre>{sessionInfo && JSON.stringify(sessionInfo, null, 2)}</pre>

      <h3>SDK Response:</h3>
      <pre>{sdkResponse && JSON.stringify(sdkResponse, null, 2)}</pre>
    </div>
  );
};

export default WhatsAppSignup;
