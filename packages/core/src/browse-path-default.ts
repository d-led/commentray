import type { CommentrayStaticBrowsePathResolver } from "./browse-contract.js";
import { staticBrowseIndexRelPathFromPair } from "./commentray-static-browse-path.js";

/** Default resolver: mirror `{storageDir}/source/…` under `browse/…/index.html`. */
export const defaultCommentrayStaticBrowsePathResolver: CommentrayStaticBrowsePathResolver = {
  browseIndexRelPathFromPair: staticBrowseIndexRelPathFromPair,
};
