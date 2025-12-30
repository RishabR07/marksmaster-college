import { GraduationCap } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-background border-t border-border mt-auto">
      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3 md:mb-4">
              {/* <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-primary" /> */}
                <img
    src="/kpt1.png"
    alt="KPT Logo"
    className="h-12 w-12 md:h-15 md:w-15 object-contain  shadow-lg"
  />
              <span className="font-bold text-foreground text-sm md:text-base">KPT Management</span>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              A modern platform for managing internal assessment marks efficiently.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground mb-2 md:mb-3 text-sm md:text-base">Quick Links</h3>
            <ul className="space-y-1 md:space-y-2 text-xs md:text-sm text-muted-foreground">
              <li><a href="/auth" className="hover:text-primary transition-colors">Login</a></li>
              <li><a href="/auth" className="hover:text-primary transition-colors">Register</a></li>
              <li><a href="#features" className="hover:text-primary transition-colors">Features</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground mb-2 md:mb-3 text-sm md:text-base">Support</h3>
            <ul className="space-y-1 md:space-y-2 text-xs md:text-sm text-muted-foreground">
              <li><a href="#help" className="hover:text-primary transition-colors">Help Center</a></li>
              <li><a href="#contact" className="hover:text-primary transition-colors">Contact Us</a></li>
              <li><a href="#privacy" className="hover:text-primary transition-colors">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-border text-center">
          <p className="pt-2 md:pt-4 text-center text-xs md:text-sm pb-4 md:pb-5 text-muted-foreground">
            Copyright 2025 ©{" "}
            <a
              href="https://rishabshetty.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Mesnaldo
            </a>
            . All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
