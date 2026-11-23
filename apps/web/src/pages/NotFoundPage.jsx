import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "./NotFoundPage.css";

function NotFoundPage() {
  return (
    <section className="ofa-not-found">
      <span>404</span>
      <h1>Lost your connection?</h1>
      <p>The page you're looking for doesn't exist.</p>
      <Link to="/">
        <ArrowLeft size={17} /> Back to home
      </Link>
    </section>
  );
}

export default NotFoundPage;