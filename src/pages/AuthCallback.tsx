import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        
        if (error) {
          console.error("Auth callback error:", error);
          navigate("/");
          return;
        }
        
        // Successfully authenticated, redirect to dashboard
        navigate("/dashboard");
      } catch (error) {
        console.error("Unexpected error in auth callback:", error);
        navigate("/");
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="text-muted-foreground">משלים את ההתחברות...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
