export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/menu",
      permanent: false
    }
  };
}

export default function SkuIndex() {
  return null;
}
