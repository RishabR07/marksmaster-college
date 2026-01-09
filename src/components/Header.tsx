import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

const Header = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50">
      {/* Glass + Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/40 via-indigo-500/30 to-purple-600/40 backdrop-blur-xl border-b border-white/10" />

      <div className="relative container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* LOGO */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <img
              src="/kpt1.png"
              alt="KPT Logo"
              className="h-11 w-11 object-contain drop-shadow-xl"
            />
            <span className="text-lg md:text-xl font-extrabold tracking-wide text-white">
              KPT Management
            </span>
          </motion.div>

          {/* DESKTOP NAV */}
          <nav className="hidden md:flex items-center gap-4">
            <ThemeToggle />

            <Button
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={() => navigate("/auth")}
            >
              Login
            </Button>

            <Button
              className="bg-white text-primary font-semibold hover:bg-white/90 shadow-lg"
              onClick={() => navigate("/auth")}
            >
              Get Started
            </Button>
          </nav>

          {/* MOBILE TOGGLE */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {/* MOBILE MENU */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="md:hidden mt-4 rounded-xl bg-white/90 dark:bg-black/60 backdrop-blur-xl border border-white/20 shadow-xl p-4 flex flex-col gap-3"
            >
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => {
                  navigate("/auth");
                  setMobileMenuOpen(false);
                }}
              >
                Login
              </Button>
              <Button
                onClick={() => {
                  navigate("/auth");
                  setMobileMenuOpen(false);
                }}
              >
                Get Started
              </Button>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};

export default Header;
