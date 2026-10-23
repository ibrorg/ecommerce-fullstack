import React, { useState, useMemo } from 'react';
import { useAppSelector } from '../store/hooks';
import api from '../services/api';
import {
  FiStar,
  FiUser,
  FiCalendar,
  FiEdit3,
  FiCheck,
  FiX,
  FiMessageCircle,
  FiThumbsUp,
  FiImage,
  FiShield,
  FiCornerUpLeft,
  FiTrash2,
  FiLoader,
} from 'react-icons/fi';

interface SellerReply {
  comment: string;
  repliedAt: string;
  repliedBy: string | { name?: string };
}

// Review interface — flexible to handle both MongoDB _id and normalized id,
// and the new photos / helpfulVotes / isVerifiedPurchase / sellerReply fields.
interface ReviewItem {
  _id?: string;
  id?: string;
  user: string | { name?: string };
  name?: string;
  rating: number;
  comment: string;
  createdAt: string;
  photos?: string[];
  helpfulVotes?: number;
  isVerifiedPurchase?: boolean;
  sellerReply?: SellerReply | null;
}

interface ReviewsProps {
  productId: string;
  reviews: ReviewItem[];
  onReviewAdded: () => void;
}

const Reviews: React.FC<ReviewsProps> = ({ productId, reviews = [], onReviewAdded }) => {
  const { user, isAuthenticated } = useAppSelector((state: any) => state.auth);

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // helpful-vote local state so the UI updates instantly
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});

  // seller reply state
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  // lightbox for review photos
  const [lightbox, setLightbox] = useState<string | null>(null);

  const reviewId = (r: ReviewItem) => r._id || r.id || '';

  const canReply =
    isAuthenticated &&
    user &&
    (user.role === 'seller' || user.role === 'admin');

  const addPhoto = () => {
    const url = photoInput.trim();
    if (!url) return;
    if (photos.length >= 5) {
      setErrorMessage('A review can have at most 5 photos');
      setSubmitStatus('error');
      return;
    }
    setPhotos((p) => [...p, url]);
    setPhotoInput('');
  };

  const removePhoto = (idx: number) => {
    setPhotos((p) => p.filter((_, i) => i !== idx));
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !user) {
      setErrorMessage('Please login to add a review');
      setSubmitStatus('error');
      return;
    }

    if (comment.trim().length < 10) {
      setErrorMessage('Please write at least 10 characters in your review');
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      await api.addProductReview(productId, {
        rating,
        comment: comment.trim(),
        photos,
      });

      setRating(5);
      setComment('');
      setPhotos([]);
      setPhotoInput('');
      setShowReviewForm(false);
      setSubmitStatus('success');
      onReviewAdded();

      setTimeout(() => setSubmitStatus('idle'), 3000);
    } catch (error: any) {
      const message =
        error.response?.data?.error || error.response?.data?.message || 'Failed to add review. Please try again.';
      setErrorMessage(message);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (review: ReviewItem) => {
    const id = reviewId(review);
    if (!id || !isAuthenticated) return;
    if (votedIds.has(id)) return;
    if (review.user === user?.id) return;

    // optimistic update
    setVotedIds((prev) => new Set(prev).add(id));
    const currentCount = voteCounts[id] ?? review.helpfulVotes ?? 0;
    setVoteCounts((prev) => ({ ...prev, [id]: currentCount + 1 }));

    try {
      await api.voteReviewHelpful(productId, id);
    } catch (error: any) {
      // rollback on failure
      setVotedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setVoteCounts((prev) => ({ ...prev, [id]: currentCount }));
      const message =
        error.response?.data?.message || 'Could not record your vote';
      setErrorMessage(message);
      setSubmitStatus('error');
      setTimeout(() => setSubmitStatus('idle'), 3000);
    }
  };

  const handleReplySubmit = async (review: ReviewItem) => {
    const id = reviewId(review);
    if (!id) return;
    if (replyText.trim().length < 2) return;

    setReplySubmitting(true);
    try {
      await api.replyToReview(productId, id, replyText.trim());
      setReplyText('');
      setReplyingId(null);
      onReviewAdded();
    } catch (error: any) {
      const message =
        error.response?.data?.message || 'Failed to post reply';
      setErrorMessage(message);
      setSubmitStatus('error');
      setTimeout(() => setSubmitStatus('idle'), 3000);
    } finally {
      setReplySubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const getRatingLabel = (rating: number) => {
    const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
    return labels[rating] || '';
  };

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
  }, [reviews]);

  const ratingDistribution = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      if (counts[r.rating] !== undefined) counts[r.rating]++;
    });
    return [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: counts[stars],
      percentage: reviews.length > 0 ? (counts[stars] / reviews.length) * 100 : 0,
    }));
  }, [reviews]);

  const renderStars = (
    rating: number,
    interactive = false,
    onStarClick?: (rating: number) => void,
    size = 'text-xl'
  ) => {
    const displayRating = interactive && hoverRating > 0 ? hoverRating : rating;
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type={interactive ? 'button' : undefined}
            onClick={interactive && onStarClick ? () => onStarClick(star) : undefined}
            onMouseEnter={interactive ? () => setHoverRating(star) : undefined}
            onMouseLeave={interactive ? () => setHoverRating(0) : undefined}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            disabled={!interactive}
            className={`${size} transition-all duration-200 ${
              star <= displayRating ? 'text-amber-400 drop-shadow-sm' : 'text-gray-200'
            } ${interactive ? 'hover:scale-125 cursor-pointer transform' : ''}`}
          >
            <FiStar
              className={star <= displayRating ? 'fill-current' : ''}
              strokeWidth={star <= displayRating ? 0 : 1.5}
            />
          </button>
        ))}
      </div>
    );
  };

  const userHasReviewed =
    reviews && reviews.length > 0 && reviews.some((review) => review.user === user?.id);

  return (
    <div className="mt-12">
      {/* lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            onClick={() => setLightbox(null)}
            aria-label="Close photo"
          >
            <FiX size={24} />
          </button>
          <img
            src={lightbox}
            alt="review"
            className="max-w-full max-h-full rounded-xl object-contain"
          />
        </div>
      )}

      {/* header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <FiMessageCircle className="w-6 h-6 text-neutral-700" />
            <h3 className="text-2xl font-bold text-neutral-900">Customer Reviews</h3>
          </div>
          <p className="text-neutral-500">
            {reviews.length > 0
              ? `Based on ${reviews.length} review${reviews.length !== 1 ? 's' : ''}`
              : 'Be the first to share your thoughts'}
          </p>
        </div>

        {isAuthenticated && !userHasReviewed && (
          <button
            onClick={() => setShowReviewForm(!showReviewForm)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl font-medium hover:bg-neutral-800 active:scale-[0.98] transition-all shadow-lg shadow-neutral-900/20"
          >
            <FiEdit3 className="w-4 h-4" />
            Write a Review
          </button>
        )}
      </div>

      {/* success toast */}
      {submitStatus === 'success' && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <FiCheck className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-green-800">Review submitted successfully!</p>
            <p className="text-sm text-green-600">Thank you for sharing your feedback.</p>
          </div>
        </div>
      )}

      {/* floating error */}
      {submitStatus === 'error' && errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <FiX className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{errorMessage}</p>
        </div>
      )}

      {/* rating summary */}
      {reviews.length > 0 && (
        <div className="bg-gradient-to-br from-neutral-50 to-neutral-100/50 rounded-2xl p-6 lg:p-8 mb-10">
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="text-center lg:text-left">
              <div className="flex items-baseline justify-center lg:justify-start gap-2 mb-2">
                <span className="text-5xl font-bold text-neutral-900">{averageRating.toFixed(1)}</span>
                <span className="text-xl text-neutral-400">/ 5</span>
              </div>
              <div className="flex justify-center lg:justify-start mb-2">
                {renderStars(Math.round(averageRating), false, undefined, 'text-2xl')}
              </div>
              <p className="text-neutral-500">{reviews.length} reviews</p>
            </div>
            <div className="space-y-2">
              {ratingDistribution.map(({ stars, count, percentage }) => (
                <div key={stars} className="flex items-center gap-3">
                  <span className="text-sm text-neutral-600 w-12">{stars} star</span>
                  <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-neutral-500 w-8">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* review form */}
      {showReviewForm && (
        <div className="mb-10 p-6 lg:p-8 bg-white border-2 border-neutral-200 rounded-2xl shadow-xl shadow-neutral-900/5 animate-slide-down">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-xl font-semibold text-neutral-900">Share Your Experience</h4>
            <button
              onClick={() => setShowReviewForm(false)}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <FiX className="w-5 h-5 text-neutral-500" />
            </button>
          </div>

          <form onSubmit={handleSubmitReview}>
            {/* rating */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-700 mb-3">
                How would you rate this product?
              </label>
              <div className="flex items-center gap-4">
                {renderStars(rating, true, setRating, 'text-3xl')}
                <span
                  className={`text-lg font-medium transition-all ${
                    hoverRating > 0 || rating > 0 ? 'text-amber-600' : 'text-neutral-400'
                  }`}
                >
                  {getRatingLabel(hoverRating > 0 ? hoverRating : rating)}
                </span>
              </div>
            </div>

            {/* comment */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Tell us more about your experience
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 transition-all resize-none"
                placeholder="What did you like or dislike? How was the quality? Would you recommend this product?"
                required
                minLength={10}
                maxLength={500}
              />
              <div className="flex justify-between mt-2">
                <p className="text-xs text-neutral-400">Minimum 10 characters</p>
                <p className={`text-xs ${comment.length > 450 ? 'text-amber-600' : 'text-neutral-400'}`}>
                  {comment.length}/500
                </p>
              </div>
            </div>

            {/* photos */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Add photos <span className="text-neutral-400">(optional, up to 5 URLs)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <FiImage className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                  <input
                    type="url"
                    value={photoInput}
                    onChange={(e) => setPhotoInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addPhoto();
                      }
                    }}
                    className="w-full pl-10 pr-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 transition-all"
                    placeholder="https://example.com/photo.jpg"
                    disabled={photos.length >= 5}
                  />
                </div>
                <button
                  type="button"
                  onClick={addPhoto}
                  disabled={!photoInput.trim() || photos.length >= 5}
                  className="px-4 py-3 rounded-xl font-medium border-2 border-neutral-200 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <FiImage size={18} />
                </button>
              </div>
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-3">
                  {photos.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={url}
                        alt={`review photo ${idx + 1}`}
                        className="w-20 h-20 rounded-lg object-cover border-2 border-neutral-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.opacity = '0.3';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <FiX size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={isSubmitting || comment.trim().length < 10}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FiCheck className="w-4 h-4" />
                    Submit Review
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowReviewForm(false)}
                className="px-6 py-3 border-2 border-neutral-200 text-neutral-700 rounded-xl font-medium hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* reviews list */}
      {reviews.length === 0 ? (
        <div className="text-center py-16 bg-neutral-50 rounded-2xl">
          <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiMessageCircle className="w-8 h-8 text-neutral-400" />
          </div>
          <h4 className="text-lg font-semibold text-neutral-900 mb-2">No reviews yet</h4>
          <p className="text-neutral-500 max-w-sm mx-auto">
            Be the first to share your thoughts about this product. Your feedback helps others make better decisions.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((review, index) => {
            const id = reviewId(review);
            const voted = votedIds.has(id);
            const helpfulCount = voteCounts[id] ?? review.helpfulVotes ?? 0;
            const isOwnReview = review.user === user?.id;
            const hasReply = !!review.sellerReply;
            const replierName =
              typeof review.sellerReply?.repliedBy === 'object'
                ? review.sellerReply?.repliedBy?.name
                : 'Seller';

            return (
              <div
                key={id || index}
                className="p-6 bg-white border border-neutral-200 rounded-2xl hover:shadow-lg hover:shadow-neutral-900/5 transition-all duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-4">
                  {/* avatar */}
                  <div className="w-12 h-12 bg-gradient-to-br from-neutral-700 to-neutral-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-white">
                      {getInitials(review.name || 'Anonymous')}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* header row */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-semibold text-neutral-900">{review.name || 'Anonymous'}</h5>
                          {review.isVerifiedPurchase && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <FiShield size={10} />
                              Verified Purchase
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {renderStars(review.rating, false, undefined, 'text-sm')}
                          <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            {getRatingLabel(review.rating)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-neutral-400">
                        <FiCalendar className="w-3.5 h-3.5" />
                        {formatDate(review.createdAt)}
                      </div>
                    </div>

                    <p className="text-neutral-700 leading-relaxed mt-3">{review.comment}</p>

                    {/* photos */}
                    {review.photos && review.photos.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {review.photos.map((photo, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => setLightbox(photo)}
                            aria-label={`View review photo ${pIdx + 1}`}
                            className="block w-16 h-16 rounded-lg overflow-hidden border-2 border-neutral-200 hover:border-neutral-400 transition-colors"
                          >
                            <img
                              src={photo}
                              alt={`review ${pIdx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* seller reply thread */}
                    {hasReply && review.sellerReply && (
                      <div className="mt-4 ml-2 pl-4 border-l-2 border-neutral-200 bg-neutral-50/60 rounded-r-lg py-3 pr-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center">
                            <FiCornerUpLeft className="text-white" size={12} />
                          </div>
                          <span className="text-sm font-bold text-neutral-900">
                            {replierName || 'Seller'} replied
                          </span>
                          {review.sellerReply.repliedAt && (
                            <span className="text-xs text-neutral-400">
                              · {formatDate(review.sellerReply.repliedAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-700 leading-relaxed pl-8">
                          {review.sellerReply.comment}
                        </p>
                      </div>
                    )}

                    {/* reply box for sellers/admins */}
                    {canReply && !hasReply && (
                      <div className="mt-3">
                        {replyingId === id ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              rows={2}
                              maxLength={1000}
                              placeholder="Write a public reply to this review..."
                              className="w-full px-3 py-2 text-sm border-2 border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900 resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleReplySubmit(review)}
                                disabled={replySubmitting || replyText.trim().length < 2}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {replySubmitting ? (
                                  <FiLoader className="animate-spin" size={14} />
                                ) : (
                                  <FiCheck size={14} />
                                )}
                                Post Reply
                              </button>
                              <button
                                onClick={() => {
                                  setReplyingId(null);
                                  setReplyText('');
                                }}
                                className="px-3 py-1.5 rounded-lg text-sm font-semibold border-2 border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setReplyingId(id);
                              setReplyText('');
                            }}
                            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
                          >
                            <FiCornerUpLeft size={14} />
                            Reply
                          </button>
                        )}
                      </div>
                    )}

                    {/* helpful button */}
                    <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center gap-4">
                      <button
                        onClick={() => handleVote(review)}
                        disabled={!isAuthenticated || isOwnReview || voted}
                        className={`inline-flex items-center gap-2 text-sm font-medium transition-all ${
                          voted
                            ? 'text-emerald-600 cursor-default'
                            : 'text-neutral-500 hover:text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        <FiThumbsUp className={voted ? 'fill-current' : ''} size={15} />
                        {voted ? 'Helpful' : 'Mark helpful'}
                        {helpfulCount > 0 && (
                          <span className="text-xs bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full">
                            {helpfulCount}
                          </span>
                        )}
                      </button>
                      {isOwnReview && (
                        <span className="text-xs text-neutral-400 italic">Your review</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* login prompt */}
      {!isAuthenticated && (
        <div className="mt-8 p-6 bg-gradient-to-r from-neutral-50 to-neutral-100 border border-neutral-200 rounded-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-neutral-200 rounded-full flex items-center justify-center flex-shrink-0">
              <FiUser className="w-6 h-6 text-neutral-600" />
            </div>
            <div>
              <p className="font-medium text-neutral-900">Share your opinion</p>
              <p className="text-neutral-600">
                <a
                  href="/login"
                  className="font-semibold underline underline-offset-2 hover:text-neutral-900 transition-colors"
                >
                  Sign in
                </a>{' '}
                to write a review and help others make better choices.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* already reviewed */}
      {isAuthenticated && userHasReviewed && (
        <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <FiCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-green-900">Thank you for your feedback!</p>
              <p className="text-green-700">
                You've already shared your thoughts on this product. Your review helps others make better decisions.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reviews;
