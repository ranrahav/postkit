import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get session from URL hash (implicit flow)
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Auth callback error:", error);
          navigate("/");
          return;
        }
        
        // If no session, try to get it from the URL
        if (!data.session) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          
          if (accessToken) {
            // Wait a moment for Supabase to process the session
            setTimeout(() => {
              navigate("/dashboard");
            }, 1000);
            return;
          } else {
            console.error("No access token found in URL");
            navigate("/");
            return;
          }
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
