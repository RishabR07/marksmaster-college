import { GraduationCap } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-background border-t border-border mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="h-6 w-6 text-primary" />
              <span className="font-bold text-foreground">College Assessment</span>
            </div>
            <p className="text-sm text-muted-foreground">
              A modern platform for managing internal assessment marks efficiently.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/auth" className="hover:text-primary transition-colors">Login</a></li>
              <li><a href="/auth" className="hover:text-primary transition-colors">Register</a></li>
              <li><a href="#features" className="hover:text-primary transition-colors">Features</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground mb-3">Support</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#help" className="hover:text-primary transition-colors">Help Center</a></li>
              <li><a href="#contact" className="hover:text-primary transition-colors">Contact Us</a></li>
              <li><a href="#privacy" className="hover:text-primary transition-colors">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>&copy; {currentYear} College Assessment System. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
