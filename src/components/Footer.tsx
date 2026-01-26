import { motion } from "framer-motion";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative mt-auto overflow-hidden">
      {/* Blue Gradient Base */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent" />

      {/* Subtle Glow */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-80 h-80 md:w-96 md:h-96 bg-primary-foreground/10 blur-3xl rounded-full" />

      <div className="relative container mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 text-primary-foreground text-center md:text-left">

          {/* BRAND */}
          <motion.div
            whileHover={{ y: -4 }}
            className="flex flex-col items-center md:items-start"
          >
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/kpt1.png"
                alt="KPT Logo"
                className="h-10 w-10 sm:h-11 sm:w-11 object-contain drop-shadow-lg"
              />
              <span className="font-extrabold text-lg">
                KPT Management
              </span>
            </div>

            <p className="text-sm text-primary-foreground/80 max-w-xs">
              A modern academic platform for managing attendance, assessments,
              and student performance efficiently.
            </p>
          </motion.div>

          {/* LINKS */}
          <div>
            <h3 className="font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-3 text-sm text-primary-foreground/80">
              <li className="hover:text-primary-foreground transition cursor-pointer">Login</li>
              <li className="hover:text-primary-foreground transition cursor-pointer">Register</li>
              <li className="hover:text-primary-foreground transition cursor-pointer">Features</li>
            </ul>
          </div>

          {/* SUPPORT */}
          <div>
            <h3 className="font-semibold mb-4">Support</h3>
            <ul className="space-y-3 text-sm text-primary-foreground/80">
              <li className="hover:text-primary-foreground transition cursor-pointer">Help Center</li>
              <li className="hover:text-primary-foreground transition cursor-pointer">Contact Us</li>
              <li className="hover:text-primary-foreground transition cursor-pointer">Privacy Policy</li>
            </ul>
          </div>
        </div>

        {/* COPYRIGHT */}
        <div className="mt-10 pt-6 border-t border-primary-foreground/20 text-center text-xs sm:text-sm text-primary-foreground/80">
          © {currentYear}{" "}
          <a
            href="https://rishabshetty.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold hover:underline text-primary-foreground"
          >
            Mesnaldo
          </a>
          . All Rights Reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
