export const REGISTRY_ABI = [
  {
    name: "requestCodeReview",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "codeHash", type: "bytes32" },
      { name: "sourceURI", type: "string" },
      { name: "executor", type: "address" },
      { name: "ttl", type: "uint64" }
    ],
    outputs: [{ name: "reviewId", type: "uint256" }]
  },
  {
    name: "commitCodeReview",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reviewId", type: "uint256" },
      { name: "score", type: "uint16" },
      {
        name: "issues",
        type: "tuple",
        components: [
          { name: "critical", type: "uint16" },
          { name: "high", type: "uint16" },
          { name: "medium", type: "uint16" },
          { name: "low", type: "uint16" },
          { name: "gas", type: "uint16" }
        ]
      },
      { name: "reportHash", type: "bytes32" },
      { name: "reportURI", type: "string" }
    ],
    outputs: []
  },
  {
    name: "mintCertificate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "reviewId", type: "uint256" }],
    outputs: [{ name: "tokenId", type: "uint256" }]
  },
  {
    name: "getReview",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "reviewId", type: "uint256" }],
    outputs: [
      { name: "developer", type: "address" },
      { name: "score", type: "uint16" },
      { name: "certificateMinted", type: "bool" },
      { name: "codeHash", type: "bytes32" },
      { name: "reportHash", type: "bytes32" },
      { name: "reportURI", type: "string" },
      {
        name: "issues",
        type: "tuple",
        components: [
          { name: "critical", type: "uint16" },
          { name: "high", type: "uint16" },
          { name: "medium", type: "uint16" },
          { name: "low", type: "uint16" },
          { name: "gas", type: "uint16" }
        ]
      }
    ]
  },
  {
    name: "getDeveloperReviews",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "developer", type: "address" }],
    outputs: [{ type: "uint256[]" }]
  },
  {
    name: "getOwnerRecords",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" }
    ],
    outputs: [{ type: "uint256[]" }]
  },
  {
    name: "requestFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    name: "passingScoreThreshold",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint16" }]
  },
  {
    name: "certificateContract",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }]
  },
  {
    name: "nextId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    name: "setRequestFee",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_fee", type: "uint256" }],
    outputs: []
  },
  {
    name: "setPassingScoreThreshold",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_threshold", type: "uint16" }],
    outputs: []
  },
  {
    name: "setCertificateContract",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_certContract", type: "address" }],
    outputs: []
  },
  {
    type: "event",
    name: "ReviewRequested",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "codeHash", type: "bytes32", indexed: true },
      { name: "jobId", type: "bytes32", indexed: false }
    ]
  },
  {
    type: "event",
    name: "ReviewCommitted",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "score", type: "uint16", indexed: false },
      { name: "reportHash", type: "bytes32", indexed: false },
      { name: "reportURI", type: "string", indexed: false }
    ]
  }
] as const;

export const CERTIFICATE_ABI = [
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }]
  },
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }]
  },
  {
    name: "locked",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "bool" }]
  }
] as const;
