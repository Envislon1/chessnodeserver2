
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-chess-dark">
      <div className="text-center p-8 border border-chess-brown/30 rounded-lg bg-chess-dark/80 shadow-lg">
        <div className="flex justify-center mb-4">
          <GraduationCap className="h-16 w-16 text-chess-accent" />
        </div>
        <h1 className="text-6xl font-bold text-chess-accent mb-4">404</h1>
        <p className="text-xl text-white mb-4">Oops! This move isn't in our playbook.</p>
        <p className="text-gray-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link to="/">
            <Button className="bg-chess-accent hover:bg-chess-accent/80 text-black">
              Return to Home
            </Button>
          </Link>
          <Link to="/matches">
            <Button variant="outline" className="border-chess-accent text-chess-accent hover:bg-chess-accent/10">
              Browse Matches
            </Button>
          </Link>
          <Link to="/register">
            <Button variant="outline" className="border-chess-accent text-chess-accent hover:bg-chess-accent/10">
              Sign Up
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
