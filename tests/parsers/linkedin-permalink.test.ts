import { describe, expect, it } from "vitest";
import { permalinkFromCommentaryId } from "../../src/platforms/linkedin/adapter";

describe("permalinkFromCommentaryId", () => {
  it("builds a permalink from shareId", () => {
    const ref = permalinkFromCommentaryId(
      'translatable-commentary-FeTranslationUrn(contentUrnCommentUrn=null, contentUrnGroupPostUrn=null, contentUrnShareUrn=ContentUrnShareUrn(shareUrn=ShareUrn(shareId=7506708460286332928)), contentUrnUgcPostUrn=null, detectedLocale=, targetLocale=tr)',
    );
    expect(ref?.postId).toBe("7506708460286332928");
    expect(ref?.permalink).toBe(
      "https://www.linkedin.com/feed/update/urn:li:share:7506708460286332928/",
    );
  });

  it("builds a permalink from userGeneratedContentId", () => {
    const ref = permalinkFromCommentaryId(
      'translatable-commentary-FeTranslationUrn(contentUrnCommentUrn=null, contentUrnGroupPostUrn=null, contentUrnShareUrn=null, contentUrnUgcPostUrn=ContentUrnUgcPostUrn(userGeneratedContentPostUrn=UserGeneratedContentPostUrn(userGeneratedContentId=7507798482632605696)), detectedLocale=, targetLocale=tr)',
    );
    expect(ref?.postId).toBe("7507798482632605696");
    expect(ref?.permalink).toBe(
      "https://www.linkedin.com/feed/update/urn:li:ugcPost:7507798482632605696/",
    );
  });

  it("returns null when there is no id", () => {
    expect(permalinkFromCommentaryId("translatable-commentary-yok")).toBeNull();
    expect(permalinkFromCommentaryId("")).toBeNull();
  });
});
