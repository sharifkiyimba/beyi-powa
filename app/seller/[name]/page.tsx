"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { db } from "@/mockData";

function SellerProfileContent() {
  const params = useParams();
  const sellerName = decodeURIComponent(params.name as string);

  const [listings, setListings] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  
  // Review Form State
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);

  const loadData = () => {
    // 1. Get phones for this seller
    const allPhones = db.getPhones();
    const sellerPhones = allPhones.filter((p: any) => p.seller === sellerName);
    setListings(sellerPhones);

    // 2. Check verification status
    const allSellers = db.getAllSellers();
    const record = allSellers.find((s: any) => s.name === sellerName);
    setIsVerified(record ? record.verified : false);

    // 3. Get reviews and calculate average
    const sellerReviews = db.getReviews(sellerName);
    setReviews(sellerReviews);
    
    if (sellerReviews.length > 0) {
      const sum = sellerReviews.reduce((acc: number, r: any) => acc + r.rating, 0);
      setAverageRating(sum / sellerReviews.length);
    }
  };

  useEffect(() => {
    loadData();
    setCurrentUser(db.getUser());
  }, [sellerName]);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    db.addReview({
      id: Date.now().toString(),
      sellerName,
      reviewerName: currentUser?.name || "Anonymous Buyer",
      rating: newRating,
      text: newComment,
      date: new Date().toLocaleDateString()
    });

    setNewComment("");
    setShowReviewForm(false);
    loadData(); // Refresh the page data
  };

  return (
    <div className="min-h-screen bg-zinc-50 pb-12">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">BP</div>
            <span className="text-lg font-bold text-zinc-900">BEYI POWA</span>
          </Link>
          <Link href="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            &larr; Back to Marketplace
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-8">
        
        {/* Seller Header */}
        <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 flex items-center gap-3">
                {sellerName}
                {isVerified && (
                  <span className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">✓</span>
                    Verified
                  </span>
                )}
              </h1>
              <div className="mt-2 flex items-center gap-3 text-sm text-zinc-600">
                <span className="flex items-center text-amber-500 font-bold">
                  ★ {averageRating > 0 ? averageRating.toFixed(1) : "No reviews"}
                </span>
                <span>•</span>
                <span>{listings.length} Active Listings</span>
              </div>
            </div>
            
            <button 
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
            >
              Write a Review
            </button>
          </div>

          {/* Review Form */}
          {showReviewForm && (
            <form onSubmit={handleSubmitReview} className="mt-6 border-t border-zinc-200 pt-6">
              <h3 className="text-lg font-semibold text-zinc-900">Leave a Review</h3>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-700">Rating:</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewRating(star)}
                    className={`text-2xl ${newRating >= star ? "text-amber-500" : "text-zinc-300"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                required
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="How was your experience with this seller?"
                className="mt-4 w-full rounded-lg border border-zinc-300 bg-white text-zinc-900 p-3 outline-none focus:ring-2 focus:ring-blue-600"
              ></textarea>
              <div className="mt-3 flex gap-2">
                <button type="submit" className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  Submit Review
                </button>
                <button type="button" onClick={() => setShowReviewForm(false)} className="rounded-lg border border-zinc-300 px-6 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Listings */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-xl font-bold text-zinc-900">Phones from {sellerName}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {listings.map((phone) => (
                <div key={phone.id} className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                  <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                    <img src={phone.image} alt={phone.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-zinc-900 text-sm">{phone.title}</h3>
                    <p className="text-sm font-bold text-blue-600 mt-1">UGX {phone.price.toLocaleString()}</p>
                    <Link href={`/listing/${phone.id}`} className="mt-2 block text-xs font-semibold text-blue-600 hover:underline">
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Reviews List */}
          <div>
            <h2 className="mb-4 text-xl font-bold text-zinc-900">Reviews ({reviews.length})</h2>
            <div className="space-y-4">
              {reviews.length === 0 ? (
                <p className="text-sm text-zinc-500">No reviews yet. Be the first to buy and leave one!</p>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-zinc-900">{review.reviewerName}</span>
                      <span className="text-xs text-zinc-400">{review.date}</span>
                    </div>
                    <div className="flex text-amber-500 text-sm mb-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s}>{s <= review.rating ? "★" : "☆"}</span>
                      ))}
                    </div>
                    <p className="text-sm text-zinc-600">{review.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SellerProfilePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-zinc-50"><p className="text-zinc-500">Loading profile...</p></div>}>
      <SellerProfileContent />
    </Suspense>
  );
}